import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-faculty-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h2>Faculty Dashboard</h2>
    <div *ngIf="loading">Loading your timetable...</div>
    <div *ngIf="error" style="color:red">{{ error }}</div>
    <div *ngIf="faculty">
      <div style="margin-bottom:1em;">Welcome, {{ faculty.name }} ({{ faculty.subject }})</div>
      <div *ngIf="timetable && timetable.length">
        <h3>Your Timetable Calendar</h3>
        <div style="display:inline-block;margin-bottom:1em;">
          <table border="1" style="border-collapse:collapse;text-align:center;">
            <thead>
              <tr>
                <th *ngFor="let d of weekDays">{{ d }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let week of calendar">
                <td *ngFor="let day of week"
                    (click)="selectDay(day)"
                    [style.background]="isReplacementDay(day) ? '#ffcc80' : (isSlotDay(day) ? '#c8e6c9' : '')"
                    [style.cursor]="day ? 'pointer' : 'default'"
                    [style.fontWeight]="selectedDay === day ? 'bold' : 'normal'"
                    [style.opacity]="day ? 1 : 0.3">
                  {{ day || '' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div *ngIf="selectedDaySlots.length">
          <h4>Slots for {{ selectedDayLabel }}</h4>
          <button *ngIf="!leaveMode && selectedDaySlots.length" (click)="markAsLeave()">Mark as Leave</button>
          <table border="1" cellpadding="5" style="border-collapse:collapse;">
            <thead>
              <tr>
                <th>Day</th>
                <th>Time Slot</th>
                <th>Subject</th>
                <th>Classroom</th>
                <th *ngIf="hasReplacement()">Replacement</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let slot of selectedDaySlots">
                <td>{{ slot.day }}</td>
                <td>{{ slot.time_slot }}</td>
                <td>{{ slot.replacement_subject || slot.subject }}</td>
                <td>{{ slot.classroom_name }}</td>
                <td *ngIf="slot.replacement">
                  {{ slot.replacement }}
                  <button (click)="removeReplacement(slot)" [disabled]="removeReplacementLoading[slot.id]">Remove</button>
                  <span *ngIf="removeReplacementLoading[slot.id]">Removing...</span>
                  <span *ngIf="removeReplacementError[slot.id]" style="color:red">{{ removeReplacementError[slot.id] }}</span>
                </td>
                <td *ngIf="leaveMode && availableFaculty[slot.id] && availableFaculty[slot.id].length">
                  <select [(ngModel)]="selectedReplacement[slot.id]">
                    <option value="">-- Select Replacement --</option>
                    <option *ngFor="let faculty of availableFaculty[slot.id]" [value]="faculty.id">
                      {{ faculty.name }} ({{ faculty.subject }})
                    </option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
          <div *ngIf="leaveMode && selectedDaySlots.length">
            <button (click)="submitAllOverrides()" [disabled]="submitAllLoading">Submit All Replacements</button>
            <span *ngIf="submitAllLoading">Submitting...</span>
            <span *ngIf="submitAllError" style="color:red">{{ submitAllError }}</span>
          </div>
        </div>
        <div *ngIf="selectedDay && !selectedDaySlots.length">
          No slots for this day.
        </div>
      </div>
      <div *ngIf="!loading && timetable && !timetable.length">
        No upcoming slots found.
      </div>
    </div>
  `
})
export class FacultyDashboardComponent implements OnInit {
  faculty: any = null;
  timetable: any[] = [];
  loading = false;
  error = '';

  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  calendar: (number | null)[][] = [];
  slotDates: Set<number> = new Set();
  replacementDates: Set<number> = new Set();
  replacementsByDateAndSlot: { [date: string]: { [slotId: number]: { name: string, id: number, replacement_subject: string } } } = {};
  selectedDay: number | null = null;
  selectedDaySlots: any[] = [];
  selectedDayLabel = '';
  leaveMode = false;
  availableFaculty: { [slotId: number]: any[] } = {};
  selectedReplacement: { [slotId: number]: string } = {};
  overrideLoading: { [slotId: number]: boolean } = {};
  overrideError: { [slotId: number]: string } = {};
  submitAllLoading = false;
  submitAllError = '';
  removeReplacementLoading: { [slotId: number]: boolean } = {};
  removeReplacementError: { [slotId: number]: string } = {};

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loading = true;
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const monthStr = `${year}-${month}`;
    this.http.get<any>('/api/me', { withCredentials: true }).subscribe({
      next: (res) => {
        if (res.user && res.user.role === 'faculty') {
          this.faculty = res.user;
          this.http.get<any[]>(`/api/faculty-overrides?faculty_id=${res.user.id}&month=${monthStr}`).subscribe({
            next: (overrides) => {
              this.replacementDates = new Set();
              this.replacementsByDateAndSlot = {};
              for (const o of overrides) {
                const d = new Date(o.date);
                if (d.getMonth() + 1 === now.getMonth() + 1 && d.getFullYear() === now.getFullYear()) {
                  this.replacementDates.add(d.getDate());
                  const dateKey = this.formatDate(d.getFullYear(), d.getMonth(), d.getDate());
                  if (!this.replacementsByDateAndSlot[dateKey]) this.replacementsByDateAndSlot[dateKey] = {};
                  this.replacementsByDateAndSlot[dateKey][o.timetable_id] = {
                    name: o.replacement_name,
                    id: o.id,
                    replacement_subject: o.replacement_subject
                  };
                }
              }
              this.http.get<any[]>(`/api/faculty-timetable?faculty_id=${res.user.id}`).subscribe({
                next: (data) => {
                  this.timetable = data;
                  this.buildCalendar();
                  this.loading = false;
                },
                error: (err) => {
                  this.error = err.error?.error || 'Failed to load timetable';
                  this.loading = false;
                }
              });
            },
            error: () => {
              this.replacementDates = new Set();
              this.replacementsByDateAndSlot = {};
            }
          });
        } else {
          this.error = 'Not logged in as faculty.';
          this.loading = false;
        }
      },
      error: () => {
        this.error = 'Not logged in.';
        this.loading = false;
      }
    });
  }

  buildCalendar() {
    // Build calendar for current month
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const numDays = lastDay.getDate();
    const calendar: (number | null)[][] = [];
    let week: (number | null)[] = Array(firstDay.getDay()).fill(null);
    // Map timetable weekday names to JS weekday numbers
    const dayNameToNum: { [k: string]: number } = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
    // Find all dates in this month that have slots
    this.slotDates = new Set();
    for (let d = 1; d <= numDays; d++) {
      const date = new Date(year, month, d);
      const weekdayNum = date.getDay();
      // Check if any slot matches this weekday
      if (this.timetable.some(slot => dayNameToNum[slot.day] === weekdayNum)) {
        this.slotDates.add(d);
      }
      week.push(d);
      if (week.length === 7) {
        calendar.push(week);
        week = [];
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null);
      calendar.push(week);
    }
    this.calendar = calendar;
    this.selectedDay = null;
    this.selectedDaySlots = [];
    this.selectedDayLabel = '';
  }

  isSlotDay(day: number | null) {
    return day !== null && this.slotDates.has(day);
  }

  isReplacementDay(day: number | null) {
    return day !== null && this.replacementDates.has(day);
  }

  selectDay(day: number | null) {
    this.selectedDay = day;
    if (!day) {
      this.selectedDaySlots = [];
      this.selectedDayLabel = '';
      this.leaveMode = false;
      return;
    }
    // Find weekday name for this date
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const date = new Date(year, month, day);
    const weekdayNum = date.getDay();
    const numToDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayName = numToDayName[weekdayNum];
    this.selectedDayLabel = `${weekdayName}, ${now.toLocaleString('default', { month: 'long' })} ${day}`;
    const dateStr = this.formatDate(year, month, day);
    this.selectedDaySlots = this.timetable.filter(slot => slot.day === weekdayName).map(slot => {
      const rep = this.replacementsByDateAndSlot[dateStr]?.[slot.id];
      if (rep) {
        return { ...slot, replacement: rep.name, replacement_subject: (rep as any).replacement_subject || slot.subject, overrideId: rep.id };
      } else {
        return slot;
      }
    });
    this.leaveMode = false;
    this.availableFaculty = {};
    this.selectedReplacement = {};
    this.overrideLoading = {};
    this.overrideError = {};
  }

  markAsLeave() {
    // For each slot, fetch available faculty
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = this.selectedDay!;
    const dateStr = this.formatDate(year, month, day);
    this.leaveMode = true;
    for (const slot of this.selectedDaySlots) {
      this.availableFaculty[slot.id] = [];
      this.selectedReplacement[slot.id] = '';
      this.overrideLoading[slot.id] = false;
      this.overrideError[slot.id] = '';
      this.http.get<any[]>(`/api/available-faculty?date=${dateStr}&time_slot=${encodeURIComponent(slot.time_slot)}&exclude_id=${this.faculty.id}`).subscribe({
        next: (data) => this.availableFaculty[slot.id] = data,
        error: () => this.availableFaculty[slot.id] = []
      });
    }
  }

  submitOverride(slot: any) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = this.selectedDay!;
    const dateStr = this.formatDate(year, month, day);
    const replacementId = this.selectedReplacement[slot.id];
    if (!replacementId) return;
    this.overrideLoading[slot.id] = true;
    this.overrideError[slot.id] = '';
    this.http.post('/api/overrides', {
      timetable_id: slot.id,
      original_faculty_id: this.faculty.id,
      replacement_faculty_id: replacementId,
      date: dateStr
    }).subscribe({
      next: () => {
        this.overrideLoading[slot.id] = false;
        // Refresh slots for this day
        this.fetchSlotsForSelectedDay();
      },
      error: (err) => {
        this.overrideError[slot.id] = err.error?.error || 'Failed to set replacement';
        this.overrideLoading[slot.id] = false;
      }
    });
  }

  fetchSlotsForSelectedDay() {
    // Refetch slots for this day with override info
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = this.selectedDay!;
    const dateStr = this.formatDate(year, month, day);
    this.http.get<any[]>(`/api/faculty-timetable?faculty_id=${this.faculty.id}&date=${dateStr}`).subscribe({
      next: (data) => {
        // Only update selectedDaySlots
        const numToDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const weekdayName = numToDayName[new Date(year, month, day).getDay()];
        this.selectedDaySlots = data.filter(slot => slot.day === weekdayName);
        this.leaveMode = false;
      },
      error: () => {
        this.leaveMode = false;
      }
    });
  }

  hasReplacement() {
    return this.selectedDaySlots && this.selectedDaySlots.some(slot => !!slot.replacement);
  }

  submitAllOverrides() {
    this.submitAllLoading = true;
    this.submitAllError = '';
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = this.selectedDay!;
    const dateStr = this.formatDate(year, month, day);
    const requests = [];
    for (const slot of this.selectedDaySlots) {
      const replacementId = this.selectedReplacement[slot.id];
      if (replacementId) {
        requests.push(this.http.post('/api/overrides', {
          timetable_id: slot.id,
          original_faculty_id: this.faculty.id,
          replacement_faculty_id: replacementId,
          date: dateStr
        }).toPromise());
      }
    }
    Promise.all(requests)
      .then(() => {
        this.submitAllLoading = false;
        this.fetchSlotsForSelectedDay();
      })
      .catch((err) => {
        this.submitAllError = 'Failed to set one or more replacements.';
        this.submitAllLoading = false;
      });
  }

  removeReplacement(slot: any) {
    if (!slot.overrideId) return;
    this.removeReplacementLoading[slot.id] = true;
    this.removeReplacementError[slot.id] = '';
    this.http.delete(`/api/overrides/${slot.overrideId}`).subscribe({
      next: () => {
        this.removeReplacementLoading[slot.id] = false;
        this.ngOnInit(); // refresh calendar and slot table together
      },
      error: (err) => {
        this.removeReplacementError[slot.id] = err.error?.error || 'Failed to remove replacement';
        this.removeReplacementLoading[slot.id] = false;
      }
    });
  }

  // Helper to format date as YYYY-MM-DD
  formatDate(year: number, month: number, day: number): string {
    return `${year}-${(month+1).toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
  }
} 