import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-public-timetable',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <h2>View Timetable</h2>
    <form (ngSubmit)="viewTimetable()" style="margin-bottom:1rem">
      <label for="classroomSelect">Select Classroom:</label>
      <select id="classroomSelect" [(ngModel)]="selectedClassroomId" name="selectedClassroomId" required>
        <option value="" disabled selected>Select Classroom</option>
        <option *ngFor="let c of classrooms" [value]="c.id">{{ c.room_number }} (Capacity: {{ c.capacity }})</option>
      </select>
      <button type="submit" [disabled]="!selectedClassroomId">View Timetable</button>
    </form>
    <div *ngIf="loading">Loading timetable...</div>
    <div *ngIf="error" style="color:red">{{ error }}</div>
    <div *ngIf="timetableWeek && timetableWeek.length">
      <h3>Timetable (Current Week)</h3>
      <table border="1" cellpadding="5" style="border-collapse:collapse;">
        <thead>
          <tr>
            <th>Time Slot</th>
            <th *ngFor="let day of timetableWeek">{{ day.day }}</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let slot of timetableTimeSlots">
            <td>{{ slot }}</td>
            <td *ngFor="let day of timetableWeek">
              <ng-container *ngIf="timetableGrid[slot][day.day] as cells">
                <div *ngFor="let cell of cells">
                  <div>{{ cell.subject }}</div>
                  <div [style.color]="cell.replacement ? 'orange' : '#555'" style="font-size:smaller;">
                    <ng-container *ngIf="cell.replacement; else normalFaculty">
                      {{ cell.replacement }} <span style="font-weight:bold;">(Replacement)</span>
                    </ng-container>
                    <ng-template #normalFaculty>
                      {{ cell.faculty }}
                    </ng-template>
                  </div>
                </div>
              </ng-container>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div *ngIf="!loading && timetableWeek && !timetableWeek.length && selectedClassroomId">
      No timetable found for this classroom.
    </div>
  `
})
export class PublicTimetableComponent implements OnInit {
  classrooms: any[] = [];
  selectedClassroomId: string = '';
  timetableWeek: any[] = [];
  timetableTimeSlots: string[] = [];
  timetableGrid: { [slot: string]: { [day: string]: any[] } } = {};
  loading = false;
  error = '';

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<any[]>('/api/classrooms').subscribe({
      next: (data) => this.classrooms = data,
      error: () => this.classrooms = []
    });
  }

  viewTimetable() {
    if (!this.selectedClassroomId) return;
    this.loading = true;
    this.error = '';
    this.http.get<any[]>(`/api/public-timetable-week?classroom_id=${this.selectedClassroomId}`).subscribe({
      next: (week) => {
        this.timetableWeek = week;
        // Build unique time slots
        const slotSet = new Set<string>();
        for (const day of week) {
          for (const slot of day.slots) {
            slotSet.add(slot.time_slot);
          }
        }
        this.timetableTimeSlots = Array.from(slotSet).sort();
        // Build grid: { time_slot: { day: slot[] } }
        const grid: { [slot: string]: { [day: string]: any[] } } = {};
        for (const slot of this.timetableTimeSlots) {
          grid[slot] = {};
          for (const day of week) {
            const found = day.slots.filter((s: any) => s.time_slot === slot);
            grid[slot][day.day] = found.length ? found : null;
          }
        }
        this.timetableGrid = grid;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.error?.error || 'Failed to load timetable';
        this.timetableWeek = [];
        this.timetableTimeSlots = [];
        this.timetableGrid = {};
        this.loading = false;
      }
    });
  }
} 