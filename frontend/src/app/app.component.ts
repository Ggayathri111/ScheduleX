import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms';
import { LoginComponent } from './login.component';
import { UserService, User, Subject, Classroom } from './user.service';
import { HttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { Location } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, LoginComponent, RouterModule], 
  template: `
    <router-outlet></router-outlet>
    <ng-container *ngIf="isRootRoute()">
      <app-login *ngIf="!isAdmin" (adminLogin)="isAdmin = true"></app-login>
      <div *ngIf="isAdmin">
        <h1>Welcome, Admin!</h1>
        <button (click)="logout()">Logout</button>

        <h2>Add Classroom</h2>
        <form (ngSubmit)="addClassroom()" #classroomForm="ngForm" style="margin-bottom:1rem">
          <input type="text" [(ngModel)]="classroomRoom" name="classroomRoom" placeholder="Room Number" required />
          <input type="number" [(ngModel)]="classroomCapacity" name="classroomCapacity" placeholder="Capacity" required />
          <button type="submit" [disabled]="addingClassroom">Add Classroom</button>
        </form>
        <div *ngIf="classroomSuccess" style="color:green">Classroom added!</div>
        <div *ngIf="classroomError" style="color:red">{{ classroomError }}</div>
        <ul *ngIf="classrooms.length">
          <li *ngFor="let c of classrooms">{{ c.room_number }} (Capacity: {{ c.capacity }})</li>
        </ul>

        <h2>Add Subject</h2>
        <form (ngSubmit)="addSubject()" #subjectForm="ngForm" style="margin-bottom:1rem">
          <input type="text" [(ngModel)]="subjectName" name="subjectName" placeholder="Subject Name" required />
          <input type="text" [(ngModel)]="subjectCode" name="subjectCode" placeholder="Subject Code" required />
          <button type="submit" [disabled]="addingSubject">Add Subject</button>
        </form>
        <div *ngIf="subjectSuccess" style="color:green">Subject added!</div>
        <div *ngIf="subjectError" style="color:red">{{ subjectError }}</div>
        <ul *ngIf="subjects.length">
          <li *ngFor="let s of subjects">{{ s.name }} ({{ s.code }})
            <button (click)="deleteSubject(s)" style="margin-left:1em;color:#fff;background:#d32f2f;border:none;padding:0.2em 0.7em;border-radius:3px;cursor:pointer;">Delete</button>
          </li>
        </ul>

        <h2>Add Faculty</h2>
        <form (ngSubmit)="addFaculty()" #facultyForm="ngForm" style="margin-bottom:2rem">
          <input type="text" [(ngModel)]="facultyName" name="facultyName" placeholder="Name" required />
          <select [(ngModel)]="facultySubject" name="facultySubject" required>
            <option value="" disabled selected>Select Subject</option>
            <option *ngFor="let s of subjects" [value]="s.name">{{ s.name }} ({{ s.code }})</option>
          </select>
          <input type="text" [(ngModel)]="facultyUsername" name="facultyUsername" placeholder="Username" required />
          <input type="password" [(ngModel)]="facultyPassword" name="facultyPassword" placeholder="Password" required />
          <button type="submit" [disabled]="addingFaculty">Add Faculty</button>
        </form>
        <div *ngIf="facultySuccess" style="color:green">Faculty added!</div>
        <div *ngIf="facultyError" style="color:red">{{ facultyError }}</div>

        <h2>All Users</h2>
        <button (click)="fetchUsers()">Reload Users</button>
        <div *ngIf="loading">Loading users...</div>
        <div *ngIf="error" style="color:red">{{ error }}</div>
        <ul *ngIf="users.length">
          <li *ngFor="let user of users">
            {{ user.name }} ({{ user.role }}) - {{ user.email || user.username }}<span *ngIf="user.subject"> | Subject: {{ user.subject }}</span>
            <button (click)="deleteUser(user)" style="margin-left:1em;color:#fff;background:#d32f2f;border:none;padding:0.2em 0.7em;border-radius:3px;cursor:pointer;">Delete</button>
          </li>
        </ul>
        <div *ngIf="!loading && !users.length && !error">
          No users found.
        </div>

        <h2>Timetable Management</h2>
        <form (ngSubmit)="viewTimetable()" style="margin-bottom:1rem">
          <label for="classroomSelect">Select Class:</label>
          <select id="classroomSelect" [(ngModel)]="selectedClassroomId" name="selectedClassroomId" required>
            <option value="" disabled selected>Select Classroom</option>
            <option *ngFor="let c of classrooms" [value]="c.id">{{ c.room_number }} (Capacity: {{ c.capacity }})</option>
          </select>
          <button type="submit" [disabled]="!selectedClassroomId">View Timetable</button>
        </form>

        <form (ngSubmit)="importTimetable()" style="margin-bottom:1rem" enctype="multipart/form-data">
          <input type="file" (change)="onFileChange($event)" accept=".csv" [disabled]="!selectedClassroomId" />
          <button type="submit" [disabled]="!selectedClassroomId || !timetableFile">Import Timetable (CSV)</button>
        </form>
        <button (click)="deleteTimetable()" [disabled]="!selectedClassroomId || !timetable.length" style="background:#d32f2f;color:#fff;border:none;padding:0.4em 1em;border-radius:3px;cursor:pointer;margin-bottom:1em;">Delete Timetable</button>
        <div *ngIf="timetableImportSuccess" style="color:green">Timetable imported!</div>
        <div *ngIf="timetableImportError" style="color:red">{{ timetableImportError }}</div>

        <div *ngIf="timetable && timetable.length">
          <h3>Timetable for Selected Class</h3>
          <table border="1" cellpadding="5" style="border-collapse:collapse;">
            <thead>
              <tr>
                <th>Day</th>
                <th *ngFor="let slot of timetableTimeSlots">{{ slot }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let day of timetableDays">
                <td>{{ day }}</td>
                <td *ngFor="let slot of timetableTimeSlots">
                  <ng-container *ngIf="timetableMap[day] && timetableMap[day][slot]">
                    <div>{{ timetableMap[day][slot].subject }}</div>
                    <div style='font-size:smaller;color:#555;'>{{ timetableMap[day][slot].faculty }}</div>
                  </ng-container>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </ng-container>
  `
})
export class AppComponent implements OnInit {
  isAdmin = false;
  users: User[] = [];
  loading = false;
  error = '';

  // Classrooms
  classrooms: Classroom[] = [];
  classroomRoom = '';
  classroomCapacity: number | null = null;
  addingClassroom = false;
  classroomSuccess = false;
  classroomError = '';

  // Subjects
  subjects: Subject[] = [];
  subjectName = '';
  subjectCode = '';
  addingSubject = false;
  subjectSuccess = false;
  subjectError = '';

  // Faculty form state
  facultyName = '';
  facultySubject = '';
  facultyUsername = '';
  facultyPassword = '';
  addingFaculty = false;
  facultySuccess = false;
  facultyError = '';

  // Timetable state
  selectedClassroomId: string = '';
  timetable: any[] = [];
  timetableFile: File | null = null;
  timetableImportSuccess = false;
  timetableImportError = '';
  timetableDays: string[] = [];
  timetableTimeSlots: string[] = [];
  timetableMap: { [day: string]: { [slot: string]: any } } = {};

  constructor(private userService: UserService, private http: HttpClient, private location: Location) {}

  ngOnInit() {
    this.fetchUsers();
    this.fetchSubjects();
    this.fetchClassrooms();
    this.http.get<any>('/api/me', { withCredentials: true }).subscribe({
      next: (res) => {
        this.isAdmin = res.user?.role === 'admin';
      },
      error: () => {
        this.isAdmin = false;
      }
    });
  }

  fetchUsers() {
    this.loading = true;
    this.userService.getUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Failed to load users';
        this.loading = false;
      }
    });
  }

  fetchSubjects() {
    this.userService.getSubjects().subscribe({
      next: (data) => {
        this.subjects = data;
      }
    });
  }

  fetchClassrooms() {
    this.userService.getClassrooms().subscribe({
      next: (data) => {
        this.classrooms = data;
      }
    });
  }

  addClassroom() {
    this.addingClassroom = true;
    this.classroomSuccess = false;
    this.classroomError = '';
    this.http.post('/api/classrooms', {
      room_number: this.classroomRoom,
      capacity: this.classroomCapacity
    }, { withCredentials: true }).subscribe({
      next: () => {
        this.classroomSuccess = true;
        this.addingClassroom = false;
        this.classroomRoom = '';
        this.classroomCapacity = null;
        this.fetchClassrooms();
      },
      error: (err) => {
        this.classroomError = err.error?.error || 'Failed to add classroom';
        this.addingClassroom = false;
      }
    });
  }

  addSubject() {
    this.addingSubject = true;
    this.subjectSuccess = false;
    this.subjectError = '';
    this.http.post('/api/subjects', {
      name: this.subjectName,
      code: this.subjectCode
    }, { withCredentials: true }).subscribe({
      next: () => {
        this.subjectSuccess = true;
        this.addingSubject = false;
        this.subjectName = '';
        this.subjectCode = '';
        this.fetchSubjects();
      },
      error: (err) => {
        this.subjectError = err.error?.error || 'Failed to add subject';
        this.addingSubject = false;
      }
    });
  }

  addFaculty() {
    this.addingFaculty = true;
    this.facultySuccess = false;
    this.facultyError = '';
    this.http.post('/api/faculty', {
      name: this.facultyName,
      subject: this.facultySubject,
      username: this.facultyUsername,
      password: this.facultyPassword
    }, { withCredentials: true }).subscribe({
      next: () => {
        this.facultySuccess = true;
        this.addingFaculty = false;
        this.facultyName = this.facultySubject = this.facultyUsername = this.facultyPassword = '';
        this.fetchUsers();
      },
      error: (err) => {
        this.facultyError = err.error?.error || 'Failed to add faculty';
        this.addingFaculty = false;
      }
    });
  }

  logout() {
    this.http.post('/api/logout', {}, { withCredentials: true }).subscribe(() => {
      window.location.reload();
    });
  }

  deleteUser(user: User) {
    if (!confirm(`Are you sure you want to delete ${user.name} (${user.role})?`)) return;
    const url = user.role === 'faculty' ? `/api/faculty/${user.id}` : `/api/users/${user.id}`;
    this.http.delete(url, { withCredentials: true }).subscribe({
      next: () => this.fetchUsers(),
      error: (err) => alert(err.error?.error || 'Failed to delete user')
    });
  }

  deleteSubject(subject: Subject) {
    if (!confirm(`Are you sure you want to delete subject '${subject.name}'?`)) return;
    this.http.delete(`/api/subjects/${subject.id}`, { withCredentials: true }).subscribe({
      next: () => this.fetchSubjects(),
      error: (err) => alert(err.error?.error || 'Failed to delete subject')
    });
  }

  viewTimetable() {
    if (!this.selectedClassroomId) return;
    this.http.get<any[]>(`/api/timetable?classroom_id=${this.selectedClassroomId}`, { withCredentials: true }).subscribe({
      next: (data) => {
        this.timetable = data;
        // Compute unique days and time slots
        const daysSet = new Set<string>();
        const slotsSet = new Set<string>();
        const map: { [day: string]: { [slot: string]: any } } = {};
        for (const row of data) {
          daysSet.add(row.day);
          slotsSet.add(row.time_slot);
          if (!map[row.day]) map[row.day] = {};
          map[row.day][row.time_slot] = row;
        }
        const weekOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        this.timetableDays = Array.from(daysSet).sort((a, b) => weekOrder.indexOf(a) - weekOrder.indexOf(b));
        this.timetableTimeSlots = Array.from(slotsSet);
        this.timetableMap = map;
      },
      error: () => {
        this.timetable = [];
        this.timetableDays = [];
        this.timetableTimeSlots = [];
        this.timetableMap = {};
      }
    });
  }

  onFileChange(event: any) {
    if (event.target.files && event.target.files.length) {
      this.timetableFile = event.target.files[0];
    } else {
      this.timetableFile = null;
    }
  }

  importTimetable() {
    if (!this.selectedClassroomId || !this.timetableFile) return;
    this.timetableImportSuccess = false;
    this.timetableImportError = '';
    const formData = new FormData();
    formData.append('classroom_id', this.selectedClassroomId);
    formData.append('file', this.timetableFile);
    this.http.post('/api/timetable/import', formData, { withCredentials: true }).subscribe({
      next: () => {
        this.timetableImportSuccess = true;
        this.timetableFile = null;
        this.viewTimetable();
      },
      error: (err) => {
        this.timetableImportError = err.error?.error || 'Failed to import timetable';
      }
    });
  }

  deleteTimetable() {
    if (!this.selectedClassroomId) return;
    if (!confirm('Are you sure you want to delete the timetable for this class?')) return;
    this.http.delete(`/api/timetable?classroom_id=${this.selectedClassroomId}`, { withCredentials: true }).subscribe({
      next: () => this.viewTimetable(),
      error: (err) => alert(err.error?.error || 'Failed to delete timetable')
    });
  }

  isRootRoute() {
    return this.location.path() === '' || this.location.path() === '/';
  }
}
