import {
    AfterViewInit,
    Component,
    ElementRef,
    HostListener,
    Input,
    OnChanges,
    OnInit,
    SimpleChanges,
    ViewChild,
    Output,
    EventEmitter
} from '@angular/core';
import { MatSlider } from '@angular/material';
import { Subject } from 'rxjs';
import { MarkerSlice } from '../../model/MarkerSlice';
import { ScanMetadata } from '../../model/ScanMetadata';
import { SliceSelection } from '../../model/selections/SliceSelection';
import { SliceRequest } from '../../model/SliceRequest';
import { DrawingContext } from '../tools/DrawingContext';
import { Tool } from '../tools/Tool';
import { List } from 'immutable';
import { MarkerZoomHandler } from '../../model/MarkerZoomHandler';

@Component({
    selector: 'app-scan-viewer',
    templateUrl: './scan-viewer.component.html',
    styleUrls: ['./scan-viewer.component.scss']
})
export class ScanViewerComponent implements OnInit, AfterViewInit, OnChanges {
    @Input() tools: List<Tool<SliceSelection>>;

    @Input() selections: List<SliceSelection>;

    currentImage: HTMLImageElement;

    @ViewChild('image')
    set viewImage(viewElement: ElementRef) {
        this.currentImage = viewElement.nativeElement;
    }

    canvas: HTMLCanvasElement;

    @ViewChild('canvas')
    set viewCanvas(viewElement: ElementRef) {
        this.canvas = viewElement.nativeElement;
        this.canvas.oncontextmenu = function(e) {
            e.preventDefault();
        };
    }

    imageContainer: HTMLDivElement;

    @ViewChild('imageContainer')
    set viewImageContainer(viewElement: ElementRef) {
        this.imageContainer = viewElement.nativeElement;
    }

    @ViewChild('slider') slider: MatSlider;

    canvasWorkspace: HTMLDivElement;

    @ViewChild('canvasWorkspace')
    set viewWorkspace(viewElement: ElementRef) {
        this.canvasWorkspace = viewElement.nativeElement;
    }

    public downloadingScanInProgress = false;
    public downloadingSlicesInProgress = false;
    public scanMetadata: ScanMetadata;
    public slices: Map<number, MarkerSlice> = new Map();
    public observableSliceRequest: Subject<SliceRequest>;
    public isSliderFocused = true;

    protected sliceBatchSize: number;
    protected drawingContext: DrawingContext;
    protected _scale = 1.0;

    protected unmodifiedImageData: ImageData = null;
    protected inMemoryCanvas: HTMLCanvasElement = null;
    protected inMemoryCanvasCtx: CanvasRenderingContext2D = null;

    set scale(scale: number) {
        this._scale = scale;
        this.resizeImageToCurrentWorkspace();
        this.updateCanvasSize();
    }

    get scale(): number {
        return this._scale;
    }

    public setZoomHandler(zoomHandler: MarkerZoomHandler) {
        this.canvas.addEventListener('mousedown', (event: MouseEvent) => {
            this.refreshContextIfNeeded(zoomHandler.mouseDownHandler(event, this.imageContainer));
        });

        this.canvas.addEventListener('mousemove', (event: MouseEvent) => {
            this.refreshContextIfNeeded(zoomHandler.mouseMoveHandler(event, this.imageContainer));
        });

        this.canvas.addEventListener('mouseup', (event: MouseEvent) => {
            this.refreshContextIfNeeded(zoomHandler.mouseUpHandler(event, this.imageContainer));
        });
    }

    private refreshContextIfNeeded(shouldRefresh: boolean) {
        if (shouldRefresh) {
            this.refreshDrawingContext();
        }
    }

    ngOnChanges(changes: SimpleChanges) {
        if ((changes.selections || changes.tools) && this.drawingContext) {
            this.refreshDrawingContext();
            this.redrawSelections();
        }
    }

    @HostListener('window:resize', ['$event'])
    onResize() {
        this.resizeImageToCurrentWorkspace();
        this.updateCanvasSize();
    }

    protected updateCanvasSize(): void {
        console.log('ScanViewer | updateCanvasSize');
        this.canvas.width = this.currentImage.width;
        this.canvas.height = this.currentImage.height;
        this.refreshDrawingContext();
        this.drawSelections();
    }

    ngAfterViewInit() {
        console.log('ScanViewer | ngAfterViewInit');
        this.tryFocusSlider();
        SliceSelection.resetIdCounter();
    }

    public setSliderFocus(focus: boolean): void {
        this.isSliderFocused = focus;
        if (this.isSliderFocused) {
            this.slider._elementRef.nativeElement.focus();
        } else {
            this.slider._elementRef.nativeElement.blur();
        }
    }

    public tryFocusSlider(): void {
        if (this.isSliderFocused) {
            // setTimeout() fixes slider focus issues in IE/Firefox
            window.setTimeout(() => this.slider._elementRef.nativeElement.focus(), 10);
        }
    }

    public get currentSlice(): number | undefined {
        return this.drawingContext && this.drawingContext.currentSlice;
    }

    public setDownloadScanInProgress(isInProgress: boolean) {
        this.downloadingScanInProgress = isInProgress;
    }

    public setDownloadSlicesInProgress(isInProgress: boolean) {
        this.downloadingSlicesInProgress = isInProgress;
    }

    public isDownloadingInProgress(): boolean {
        return this.downloadingScanInProgress || this.downloadingSlicesInProgress;
    }

    public clearData(): void {
        this.slices = new Map<number, MarkerSlice>();
        this.drawingContext = undefined;
        SliceSelection.resetIdCounter();
    }

    public feedData(newSlice: MarkerSlice): void {
        console.log('ScanViewer | feedData: ', newSlice);
        if (!this.drawingContext) {
            this.refreshDrawingContext();
        }
        this.slices.set(newSlice.index, newSlice);
        this.updateSliderRange();
    }

    protected updateSliderRange(): void {
        const sortedKeys: number[] = Array.from(this.slices.keys()).sort((a: number, b: number) => {
            return a - b;
        });
        console.log('ScanViewer | updateSliderRange | sortedKeys: ', sortedKeys);

        this.slider.min = sortedKeys[0];
        this.slider.max = sortedKeys[sortedKeys.length - 1];
    }

    public setScanMetadata(scanMetadata: ScanMetadata): void {
        this.scanMetadata = scanMetadata;
    }

    public hookUpSliceObserver(sliceBatchSize: number): Promise<boolean> {
        this.sliceBatchSize = sliceBatchSize;
        return new Promise(resolve => {
            this.observableSliceRequest = new Subject<SliceRequest>();
            resolve(true);
        });
    }

    ngOnInit() {
        console.log('ScanViewer | ngOnInit');
        console.log('View elements: image ', this.currentImage, ', canvas ', this.canvas, ', slider ', this.slider);

        this.refreshDrawingContext();

        this.initializeImage(() => this.drawSelections());
    }

    public selectMiddleSlice(): void {
        this.changeSlice(Math.round((this.getMinSliceIndex() + this.getMaxSliceIndex()) / 2));
    }

    public changeSlice(sliceIndex: number): void {
        console.log('Change slice to: ', sliceIndex);
        if (this.currentSlice !== sliceIndex && this.canChangeSlice(sliceIndex)) {
            this.drawingContext.currentSlice = sliceIndex;
            this.currentImage.src = (this.slices.get(sliceIndex) && this.slices.get(sliceIndex).source) || '';
            this.unmodifiedImageData = null;
            this.resizeImageToCurrentWorkspace();
            this.redrawSelections();
            this.requestSlicesIfNeeded();
        }
    }

    private canChangeSlice(sliceIndexCandidate: number): boolean {
        return this.getMaxSliceIndex() >= sliceIndexCandidate && this.getMinSliceIndex() <= sliceIndexCandidate;
    }

    public getMinSliceIndex(): number {
        return Math.min(...this.slices.keys());
    }

    public getMaxSliceIndex(): number {
        return Math.max(...this.slices.keys());
    }

    protected requestSlicesIfNeeded(): void {
        console.log('ScanViewer | requestSlicesIfNeeded sliceIndex: ', this.currentSlice);
        if (this.getMaxSliceIndex() === this.currentSlice && this.currentSlice < this.scanMetadata.numberOfSlices) {
            console.log('ScanViewer | requestSlicesIfNeeded more (higher indexes): ', this.currentSlice + 1);
            this.observableSliceRequest.next(new SliceRequest(this.currentSlice + 1));
        }
        if (this.getMinSliceIndex() === this.currentSlice && this.currentSlice > 0) {
            console.log('ScanViewer | requestSlicesIfNeeded more (lower indexes): ', this.currentSlice - 1);
            this.observableSliceRequest.next(new SliceRequest(this.currentSlice - 1, true));
        }
    }

    protected initializeImage(afterImageLoad?: () => void): void {
        this.currentImage.onload = (event: Event) => {
            if (afterImageLoad) {
                afterImageLoad();
            }
            this.updateCanvasSize();
        };
    }

    protected resizeImageToCurrentWorkspace(): void {
        console.log(
            'ScanViewer | resizeImageToCurrentWorkspace | scanMetadata (width, height): ',
            this.scanMetadata.width,
            this.scanMetadata.height
        );
        console.log('ScanViewer | resizeImageToCurrentWorkspace | canvasWorkspace (client rect): ', this.canvasWorkspace.getClientRects());

        const maxImageSize = Math.max(this.scanMetadata.width, this.scanMetadata.height);
        const minCanvasSize = Math.min(this.canvasWorkspace.clientWidth, this.canvasWorkspace.clientHeight);
        const ratioScalar = (minCanvasSize * this.scale) / maxImageSize;

        console.log('ScanViewer | resizeImageToCurrentWorkspace | ratioScalar: ', ratioScalar);

        const imageSize = {
            width: this.scanMetadata.width * ratioScalar,
            height: this.scanMetadata.height * ratioScalar
        };

        this.currentImage.style.maxWidth = imageSize.width + 'px';
        this.currentImage.style.maxHeight = imageSize.height + 'px';

        this.currentImage.width = imageSize.width;
        this.currentImage.height = imageSize.height;

        if (imageSize.width < this.canvasWorkspace.clientWidth) {
            const left = this.canvasWorkspace.clientWidth / 2 - this.currentImage.width / 2 + 'px';
            this.currentImage.style.left = left;
            this.canvas.style.left = left;
        }
        if (imageSize.height < this.canvasWorkspace.clientHeight) {
            const top = this.canvasWorkspace.clientHeight / 2 - this.currentImage.height / 2 + 'px';
            this.currentImage.style.top = top;
            this.canvas.style.top = top;
        }

        this.refreshDrawingContext();
    }

    protected drawSelections(): void {
        this.selections
            .forEach(selection => {
                const isOnCurrentSlice = selection.sliceIndex === this.currentSlice;
                if ((selection.pinned || isOnCurrentSlice) && !selection.hidden) {
                    const tool: Tool<SliceSelection> = this.getToolByName(selection.labelTool);
                    tool.drawSelection(selection);
                }
            });
    }

    protected clearCanvas(): void {
        this.canvas.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    protected redrawSelections(): void {
        this.clearCanvas();
        this.drawSelections();
    }

    protected refreshDrawingContext(): void {
        this.drawingContext = this.createDrawingContext();
        this.tools.forEach(tool => tool.setDrawingContext(this.drawingContext));
    }

    protected createDrawingContext(): DrawingContext {
        const currentSlice = this.currentSlice;
        return new DrawingContext(this.canvas, this.selections, currentSlice, null, null, this.redrawSelections.bind(this));
    }

    protected getToolByName(toolName: string): Tool<SliceSelection> {
        return this.tools.find(x => x.getToolName() === toolName);
    }

    private getUnmodifiedImageData(): Uint8ClampedArray {
        if (this.inMemoryCanvas == null) {
            this.inMemoryCanvas = <HTMLCanvasElement>document.createElement('canvas');
            this.inMemoryCanvasCtx = this.inMemoryCanvas.getContext('2d');
        }

        if (this.unmodifiedImageData == null) {
            this.inMemoryCanvas.width = this.currentImage.width;
            this.inMemoryCanvas.height = this.currentImage.height;
            this.inMemoryCanvasCtx.drawImage(this.currentImage, 0, 0, this.currentImage.width, this.currentImage.height);

            this.unmodifiedImageData = this.inMemoryCanvasCtx.getImageData(0, 0, this.currentImage.width, this.currentImage.height);
        }

        return new Uint8ClampedArray(this.unmodifiedImageData.data);
    }

    public modifyViewerImage(transformer: (imageRGBBytes: Uint8ClampedArray) => Uint8ClampedArray) {
        const imageBytes: Uint8ClampedArray = this.getUnmodifiedImageData();

        const modifiedImage: ImageData = new ImageData(transformer(imageBytes), this.currentImage.width, this.currentImage.height);
        this.inMemoryCanvasCtx.putImageData(modifiedImage, 0, 0);

        this.currentImage.src = this.inMemoryCanvas.toDataURL('image/png');
        this.resizeImageToCurrentWorkspace();
    }
}
