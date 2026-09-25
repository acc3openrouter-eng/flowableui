import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MessageService, ConfirmationService } from '@openng/optimus-ui/api';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), MessageService, ConfirmationService],
    }).compileComponents();
  });

  it('creates the root component', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });
});
