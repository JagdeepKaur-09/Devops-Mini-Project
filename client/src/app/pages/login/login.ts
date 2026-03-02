import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_BASE } from '../../api.config';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  email = '';
  password = '';
  errorMsg = '';
  loading = false;

  constructor(private http: HttpClient, private router: Router) { }

  login() {
    if (!this.email || !this.password) {
      this.errorMsg = 'Please enter your email and password.';
      return;
    }
    this.loading = true;
    this.errorMsg = '';

    this.http.post<{ token: string }>(`${API_BASE}/auth/login`, {
      email: this.email,
      password: this.password
    }).subscribe({
      next: (res) => {
        localStorage.setItem('token', res.token);
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.error ?? 'Login failed. Please try again.';
      }
    });
  }
}
