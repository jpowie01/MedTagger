import { Component, Output, EventEmitter, ViewChild, ElementRef, Input } from '@angular/core';
import { PredefinedLabelToUpload, handlePredefinedLabelFile } from '../../utils/PredefinedLabelHandler';

const FILE_SIZE_LIMIT = 5;  // MB

export class SelectedScan {
    directory = '';
    files: File[] = [];
    predefinedLabels: Array<PredefinedLabelToUpload> = [];
    predefinedLabelsTasks: Array<string> = [];
    additionalData: Object = {};

    constructor(directory = '', files: File[] = [], predefinedLabels: Array<PredefinedLabelToUpload> = [],
                predefinedLabelsTasks: Array<string> = [], additionalData: Object = {}) {
        this.directory = directory;
        this.files = files;
        this.predefinedLabels = predefinedLabels;
        this.predefinedLabelsTasks = predefinedLabelsTasks;
        this.additionalData = additionalData;
    }

    public addPredefinedLabel(file: File): Promise<void> {
        return new Promise(((resolve, reject) => {
            handlePredefinedLabelFile(file).then((values: [string, PredefinedLabelToUpload]) => {
                const taskKey = values[0], predefinedLabel = values[1];
                this.predefinedLabelsTasks.push(taskKey);
                this.predefinedLabels.push(predefinedLabel);
                resolve();
            }, _ => {
                reject();
            });
        }));
    }

    public addAdditionalData(key: string, value: Object): void {
        this.additionalData[key] = value;
    }
}

export class IncompatibleFile {
    file: File;
    reason: string;

    constructor(file: File, reason: string) {
        this.file = file;
        this.reason = reason;
    }
}

export class UserFiles {
    scans: SelectedScan[];
    numberOfSlices: number;
    incompatibleFiles: IncompatibleFile[];

    constructor(scans: SelectedScan[], numberOfSlices: number, incompatibleFiles: IncompatibleFile[]) {
        this.scans = scans;
        this.numberOfSlices = numberOfSlices;
        this.incompatibleFiles = incompatibleFiles;
    }
}

@Component({
    selector: 'app-upload-scans-selector',
    templateUrl: './upload-scans-selector.component.html'
})
export class UploadScansSelectorComponent {
    @Input() multipleScans: boolean;
    @Output() onFileSelect: EventEmitter<object> = new EventEmitter();

    public ACCEPTED_FILE_TYPES = ['.dcm', '.png', '.json'].join(',');
    @ViewChild('inputFile') nativeInputFile: ElementRef;
    private userSelectedFiles: File[] = [];

    public scans: SelectedScan[] = [];
    public totalNumberOfSlices = 0;
    public incompatibleFiles: IncompatibleFile[] = [];

    // https://en.wikipedia.org/wiki/List_of_file_signatures -> DICOM format
    private DICOM_BYTE_SIGNATURE = '4449434D';
    private DICOM_BYTE_SIGNATURE_OFFSET = 128;

    private async isCompatibleSliceFile(sliceFile: File, scan: SelectedScan): Promise<[boolean, SelectedScan]> {
        let isCompatible = null;

        // Skip all files that are not DICOMs
        await this.isFileDicom(sliceFile).then(() => {
            // Check for size limit (5 MB)
            if (sliceFile.size > FILE_SIZE_LIMIT * 1024 * 1024) {
                const fileSize = Math.round(sliceFile.size / 1024 / 1024);
                const reason = 'Too large File! This file has ' + fileSize + 'MB but the limit is ' + FILE_SIZE_LIMIT + 'MB.';
                this.incompatibleFiles.push(new IncompatibleFile(sliceFile, reason));
                isCompatible = false;
            }

            isCompatible = true;
        }, (error: Error) => {
            const reason = 'Incompatible MIME Type! Should be "application/dicom" but File has type "' + sliceFile.type + '".';
            console.log(reason, error);
            this.incompatibleFiles.push(new IncompatibleFile(sliceFile, reason));
            isCompatible = false;
        });

        return [isCompatible, scan];
    }

    private async isFileDicom(sliceFile: File): Promise<any> {
        return new Promise(((resolve, reject) => {
            if (sliceFile.type === 'application/dicom') {
                resolve();
            } else {
                const fileReader: FileReader = new FileReader();

                fileReader.onloadend = (e: ProgressEvent) => {
                    const fileHeaderBytes = new Uint8Array(fileReader.result as ArrayBuffer);

                    const singatureBytesValues: string[] = [];

                    fileHeaderBytes.forEach((byte) => {
                        singatureBytesValues.push(byte.toString(16));
                    });

                    const fileSignature: string = singatureBytesValues.join('').toUpperCase();

                    if (fileSignature === this.DICOM_BYTE_SIGNATURE) {
                        resolve();
                    } else {
                        reject(new Error('Not a DICOM file!'));
                    }
                };
                const blob = sliceFile.slice(this.DICOM_BYTE_SIGNATURE_OFFSET, this.DICOM_BYTE_SIGNATURE_OFFSET + 4);
                fileReader.readAsArrayBuffer(blob);
            }
        }));
    }

    private prepareScans(): Promise<void> {
        // Always start with empty list and we will fill it by iterating over files
        this.scans = [];
        this.incompatibleFiles = [];

        // User didn't select any files
        if (!this.userSelectedFiles || this.userSelectedFiles.length === 0) {
            return Promise.resolve();
        }

        if (!this.multipleScans) {
            return this.prepareSingleScan();
        }

        return this.prepareMultipleScans();
    }

    private prepareSingleScan(): Promise<void> {
        const promises: Array<Promise<any>> = [];
        const singleScan = new SelectedScan();
        this.scans.push(singleScan);

        for (const selectedFile of this.userSelectedFiles) {
            // User can upload a JSON file which will represent Predefined Label
            if (selectedFile.name.endsWith('.json') && selectedFile.type === 'application/json') {
                promises.push(singleScan.addPredefinedLabel(selectedFile));
                continue;
            }

            // User can upload a PNG file which will represent Brush Predefined Label Element
            if (selectedFile.name.endsWith('.png') && selectedFile.type === 'image/png') {
                singleScan.addAdditionalData(selectedFile.name, selectedFile);
                continue;
            }

            // Check file compatibility and add it to the list of incompatible files
            promises.push(this.isCompatibleSliceFile(selectedFile, singleScan).then((result: [boolean, SelectedScan]) => {
                const isCompatible: boolean = result[0];
                const scanForThisSlice: SelectedScan = result[1];
                if (isCompatible) {
                    this.totalNumberOfSlices += 1;
                    scanForThisSlice.files.push(selectedFile);
                }
            }));
        }

        return Promise.all(promises).then(() => {
            // As we cannot fetch these files' directory, we've got to display something on the UI
            singleScan.directory = 'Single 3D Scan (' + this.totalNumberOfSlices + ' DICOMs)';
        });
    }

    /**
    * @deprecated To be adressed in future upload refactor
    */
    private prepareMultipleScans(): Promise<void> {
        const promises: Array<Promise<any>> = [];

        for (const selectedFile of this.userSelectedFiles) {
            const slicePath = selectedFile['webkitRelativePath'];
            const currentScanDirectory = slicePath.split('/').slice(0, -1).join('/');
            let scanForThisSlice = this.scans.find((scan: SelectedScan) => {
                return scan.directory === currentScanDirectory;
            });
            if (!scanForThisSlice) {
                scanForThisSlice = new SelectedScan();
                scanForThisSlice.directory = currentScanDirectory;
                this.scans.splice(0, 0, scanForThisSlice);
            }

            // User can upload a JSON file which will represent Predefined Label
            if (selectedFile.name.endsWith('.json') && selectedFile.type === 'application/json') {
                promises.push(scanForThisSlice.addPredefinedLabel(selectedFile));
                continue;
            }

            // User can upload a PNG file which will represent Brush Predefined Label Element
            if (selectedFile.name.endsWith('.png') && selectedFile.type === 'image/png') {
                scanForThisSlice.addAdditionalData(selectedFile.name, selectedFile);
                continue;
            }

            // Check file compatibility and add it to the list of incompatible files
            promises.push(this.isCompatibleSliceFile(selectedFile, scanForThisSlice).then((result: [boolean, SelectedScan]) => {
                const isCompatible: boolean = result[0];
                const scan: SelectedScan = result[1];
                if (isCompatible) {
                    this.totalNumberOfSlices += 1;
                    scan.files.push(selectedFile);
                }
            }));
        }

        return Promise.all(promises).then(() => {});
    }

    public onNativeInputFileSelect($event): void {
        this.scans = [];
        this.incompatibleFiles = [];
        this.totalNumberOfSlices = 0;
        this.userSelectedFiles = $event.target.files || $event.scrElement.files;
        this.prepareScans().then(() => {
            this.onFileSelect.emit(new UserFiles(this.scans, this.totalNumberOfSlices, this.incompatibleFiles));
        });
    }

    public selectFile(): void {
        this.nativeInputFile.nativeElement.click();
    }

    public reinitialize(): void {
        this.userSelectedFiles = [];
        this.totalNumberOfSlices = 0;
        this.scans = [];
        this.incompatibleFiles = [];
    }
}
