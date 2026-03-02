import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_BASE } from '../../api.config';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './signup.html',
  styleUrl: './signup.css'
})
export class SignupComponent {
  name = '';
  email = '';
  password = '';
  errorMsg = '';
  successMsg = '';
  loading = false;

  constructor(private http: HttpClient, private router: Router) { }

  signup() {
    if (!this.name || !this.email || !this.password) {
      this.errorMsg = 'All fields are required.';
      return;
    }
    this.loading = true;
    this.errorMsg = '';

    this.http.post<{ message: string }>(`${API_BASE}/auth/signup`, {
      name: this.name,
      email: this.email,
      password: this.password
    }).subscribe({
      next: () => {
        this.loading = false;
        this.successMsg = 'Account created! Redirecting to login...';
        setTimeout(() => this.router.navigate(['/login']), 2000);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = err.error?.error ?? 'Signup failed. Please try again.';
      }
    });
  }
}
