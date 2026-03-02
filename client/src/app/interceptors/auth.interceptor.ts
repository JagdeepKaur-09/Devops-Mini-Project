import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError, timeout } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const token = localStorage.getItem('token');

    // Attach token to all /api/ requests
    const authReq = token && req.url.includes('/api/')
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

    return next(authReq).pipe(
        // 15 second timeout — prevents infinite loading if server is slow
        timeout(15000),
        catchError(err => {
            if (err.status === 401) {
                // Token expired or invalid — clear and redirect to login
                localStorage.removeItem('token');
                // Use window.location to avoid circular DI issues with inject(Router)
                window.location.href = '/login';
            }
            return throwError(() => err);
        })
    );
};
