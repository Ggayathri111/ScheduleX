import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  id: number;
  name: string;
  email?: string;
  username?: string;
  subject?: string;
  role: string;
}

export interface Subject {
  id: number;
  name: string;
  code: string;
}

export interface Classroom {
  id: number;
  room_number: string;
  capacity: number;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiUrl = '/api/users';

  constructor(private http: HttpClient) {}

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(this.apiUrl);
  }

  getSubjects(): Observable<Subject[]> {
    return this.http.get<Subject[]>('/api/subjects');
  }

  getClassrooms(): Observable<Classroom[]> {
    return this.http.get<Classroom[]>('/api/classrooms');
  }
} 