import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { NavigationToolbarComponent } from './navigation-toolbar/navigation-toolbar.component';

@NgModule({
  declarations: [
    AppComponent,
    NavigationToolbarComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
