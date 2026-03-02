import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { LoginComponent } from './pages/login/login';
import { SignupComponent } from './pages/signup/signup';
import { DashboardComponent } from './pages/dashboard/dashboard';
import { UploadComponent } from './pages/upload/upload';
import { RoomComponent } from './pages/room/room';
import { RegisterFaceComponent } from './pages/register-face/register-face';
import { ConsentComponent } from './pages/consent/consent';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'signup', component: SignupComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'upload/:roomId', component: UploadComponent, canActivate: [authGuard] },
  { path: 'room/:roomCode', component: RoomComponent, canActivate: [authGuard] },
  { path: 'face-consent', component: ConsentComponent, canActivate: [authGuard] },
  { path: 'register-face', component: RegisterFaceComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'login' },
];
