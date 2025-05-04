import { Component, Output, EventEmitter } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  email = '';
  username = '';
  password = '';
  error = '';
  loading = false;
  @Output() adminLogin = new EventEmitter<boolean>();

  constructor(private http: HttpClient, private router: Router) {}

  login() {
    this.loading = true;
    this.error = '';
    this.http.post<any>('/api/login', {
      email: this.email,
      username: this.username,
      password: this.password
    }, { withCredentials: true })
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.role === 'admin') {
            this.adminLogin.emit(true);
          } else if (res.role === 'faculty') {
            this.router.navigateByUrl('/faculty');
          }
        },
        error: (err) => {
          this.error = err.error?.error || 'Login failed';
          this.loading = false;
        }
      });
  }
}