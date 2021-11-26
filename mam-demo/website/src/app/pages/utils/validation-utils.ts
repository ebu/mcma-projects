import { AbstractControl, ValidationErrors, ValidatorFn } from "@angular/forms";
import { FileInput } from "ngx-material-file-input";

export namespace FormValidationUtils {
  export function fileExtensions(extensions: string[]): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (control?.value) {
        const lowerCaseExtensions = extensions.map(ext => ext.toLowerCase());

        const fileInput = (control.value as FileInput);
        const inputFiles = fileInput.files.map(file => file.name);
        const invalidFiles = inputFiles.filter(f => !lowerCaseExtensions.includes(f.toLowerCase().substring(f.lastIndexOf(".") + 1)));

        const condition = invalidFiles.length > 0;
        if (condition) {
          return {
            invalidFileExtension: {
              invalidFiles
            }
          };
        }
      }
      return null;
    };
  }
}
