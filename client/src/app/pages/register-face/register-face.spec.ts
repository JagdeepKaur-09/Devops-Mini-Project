import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RegisterFace } from './register-face';

describe('RegisterFace', () => {
  let component: RegisterFace;
  let fixture: ComponentFixture<RegisterFace>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterFace],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterFace);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
