import { Component, Input, Output, EventEmitter } from '@angular/core';

import { WorkflowJob } from 'mcma-core';
import { ThemePalette } from '@angular/material';

@Component({
    selector: 'mcma-monitor-queue',
    styleUrls: ['./monitor-queue.component.scss'],
    templateUrl: './monitor-queue.component.html',
})
export class MonitorQueueComponent {
    readonly displayedColumns = ['title', 'filename', 'status'];

    selectedJob;

    @Input() workflowJobs: WorkflowJob[];
    @Output() jobSelected = new EventEmitter<WorkflowJob>(null);

    getStatusIcon(status: string): string {
        if (!status) {
            return '';
        }

        switch (status.toUpperCase()) {
            case 'RUNNING':
                return 'play';
            case 'COMPLETED':
                return 'check';
            case 'FAILED':
                return 'error';
        }
    }

    getStatusColor(status: string): ThemePalette {
        if (!status) {
            return null;
        }

        switch (status.toUpperCase()) {
            case 'RUNNING':
                return 'primary';
            case 'COMPLETED':
                return 'accent';
            case 'FAILED':
                return 'warn';
        }
    }

    selectJob(row) {
        this.selectedJob = row;
        this.jobSelected.emit(row)
    }
}
