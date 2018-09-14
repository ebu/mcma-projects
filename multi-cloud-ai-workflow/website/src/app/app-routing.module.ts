import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './guards/auth.guard';
import { RunComponent } from './run/run.component';
import { MonitorComponent } from './monitor/monitor.component';
import { ServicesComponent } from './services-page/services.component';

export const routes: Routes = [
    { path: 'run', component: RunComponent },
    { path: 'monitor', component: MonitorComponent },
    { path: 'services', component: ServicesComponent },
    { path: '', redirectTo: 'run', pathMatch: 'full' }
];

@NgModule({
    imports: [
        RouterModule.forRoot(routes,
            {
                useHash: true
            }),
    ],
    exports: [
        RouterModule
    ]
})
export class AppRoutingModule { }