import { NgModule } from "@angular/core";

import { MatButtonModule, MatCardModule, MatCheckboxModule, MatIconModule, MatInputModule, MatListModule, MatPaginatorModule, MatSidenavModule, MatTableModule, MatTabsModule, MatToolbarModule } from "@angular/material";

@NgModule({
    imports: [
        MatButtonModule,
        MatCheckboxModule,
        MatInputModule,
        MatSidenavModule,
        MatToolbarModule,
        MatIconModule,
        MatListModule,
        MatTableModule,
        MatTabsModule,
        MatPaginatorModule,
        MatCardModule
    ],
    exports: [
        MatButtonModule,
        MatCheckboxModule,
        MatInputModule,
        MatSidenavModule,
        MatToolbarModule,
        MatIconModule,
        MatListModule,
        MatTableModule,
        MatTabsModule,
        MatPaginatorModule,
        MatCardModule
    ]
})
export class MaterialModule {}
