import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
    selector: 'app-consent',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './consent.html',
    styleUrl: './consent.css'
})
export class ConsentComponent {
    constructor(private router: Router) { }

    agree(): void {
        // localStorage so consent persists across page refreshes
        localStorage.setItem('faceConsentGiven', 'true');
        this.router.navigate(['/register-face']);
    }

    decline(): void {
        this.router.navigate(['/dashboard']);
    }
}
