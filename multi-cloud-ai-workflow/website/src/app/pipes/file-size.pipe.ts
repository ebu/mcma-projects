import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'fileSize' })
export class FileSizePipe implements PipeTransform {
    transform(value: number) {
        let display = value;
        let unit = 'B';
        if (value >= (1024 * 1024 * 1024)) {
            display = value / (1024 * 1024 * 1024);
            unit = 'GB';
        } else if (value >= (1024 * 1024)) {
            display = value / (1024 * 1024);
            unit = 'MB';
        } else if (value >= 1024) {
            display = value / 1024;
            unit = 'KB';
        }

        display = Math.round(display * 100) / 100;

        return display + ' ' + unit;
    }
}