import {Component} from '@angular/core';

export interface PeriodicElement {
  description: string;
  title: string;
  filename: string;
  status: string;
}

const ELEMENT_DATA: PeriodicElement[] = [
  {title: 'This is a test 1', description: 'Testing', filename: 'test.mp4', status: 'Processing'},
  {title: 'This is a test 2', description: 'Testing', filename: 'test.mp4', status: 'Processing'},
  {title: 'This is a test 3', description: 'Testing', filename: 'test.mp4', status: 'Processing'},
  {title: 'This is a test 4', description: 'Testing', filename: 'test.mp4', status: 'Processing'},
  {title: 'This is a test 5', description: 'Testing', filename: 'test.mp4', status: 'Processing'},
  {title: 'This is a test 6', description: 'Testing', filename: 'test.mp4', status: 'Processing'},
  {title: 'This is a test 7', description: 'Testing', filename: 'test.mp4', status: 'Processing'},
  {title: 'This is a test 8', description: 'Testing', filename: 'test.mp4', status: 'Processing'},
  {title: 'This is a test 9', description: 'Testing', filename: 'test.mp4', status: 'Processing'},
  {title: 'This is a test 10', description: 'Testing', filename: 'test.mp4', status: 'Completed'},
];

/**
 * @title Basic use of `<table mat-table>`
 */
@Component({
  selector: 'monitor-queue',
  styleUrls: ['./monitor-queue.component.scss'],
  templateUrl: './monitor-queue.component.html',
})
export class MonitorQueueComponent {
  displayedColumns: string[] = ['title', 'description', 'filename', 'status'];
  dataSource = ELEMENT_DATA;
}


/**  Copyright 2018 Google Inc. All Rights Reserved.
    Use of this source code is governed by an MIT-style license that
    can be found in the LICENSE file at http://angular.io/license */