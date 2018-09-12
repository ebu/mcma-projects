import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AuthGuard } from './guards/auth.guard';
import { RunComponent } from './run/run.component';
import { MonitorComponent } from './monitor/monitor.component';
import { ServicesComponent } from './services-page/services.component';

export const routes: Routes = [
    { path: 'run', component: RunComponent, canActivate: [AuthGuard] },
    { path: 'monitor', component: MonitorComponent, canActivate: [AuthGuard] },
    { path: 'services', component: ServicesComponent, canActivate: [AuthGuard] },
    { path: '', redirectTo: 'run', pathMatch: 'full', canActivate: [AuthGuard] }
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