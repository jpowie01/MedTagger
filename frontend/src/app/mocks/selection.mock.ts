import { SliceSelection, SliceSelectionType } from '../model/selections/SliceSelection';
import { LabelTag } from '../model/labels/LabelTag';

export class SelectionMock extends SliceSelection {
    constructor(sliceIndex: number,
                labelTool: string,
                labelTag: LabelTag) {
        super(sliceIndex, labelTool, labelTag, SliceSelectionType.NORMAL);
    }

    getAdditionalData(): Object {
        return {};
    }

    toJSON(): Object {
        return {
            'width': 1,
            'height': 1,
            'slice_index': this.sliceIndex,
            'tag': this.labelTag.key,
            'tool': this.labelTool
        };
    }
}
