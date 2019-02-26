import os
import math

from PIL import Image
import SimpleITK as sitk

MAPPING = {
    11: 'data/microscope/dicom/3_0.dcm',
    10: 'data/microscope/dicom/4_0.dcm',
    9: 'data/microscope/dicom/5_0.dcm',
    8: 'data/microscope/dicom/6_0.dcm',
    7: 'data/microscope/dicom/7_0.dcm',
    6: 'data/microscope/dicom/8_0.dcm',
    5: 'data/microscope/dicom/9_0.dcm',
    4: 'data/microscope/dicom/10_0.dcm',
    3: 'data/microscope/dicom/11_0.dcm',
    2: 'data/microscope/dicom/12_0.dcm',
    1: 'data/microscope/dicom/13_0.dcm',
    0: 'data/microscope/dicom/14_0.dcm',
}

for z in sorted(MAPPING.keys(), reverse=True):
    print(f'Processing Z={z}...')
    os.makedirs(f'data/microscope/png/{z}/', exist_ok=True)
    file_name = MAPPING[z]
    dicom_file = sitk.ReadImage(file_name)
    array = sitk.GetArrayFromImage(dicom_file)
    tile_width_px = dicom_file.GetWidth()
    tile_height_px = dicom_file.GetHeight()
    width_px = int(dicom_file.GetMetaData('0048|0006'))
    height_px = int(dicom_file.GetMetaData('0048|0007'))
    tiles_x = int(math.ceil(width_px / tile_width_px))
    tiles_y = int(math.ceil(height_px / tile_height_px))
    for y in range(tiles_y):
        for x in range(tiles_x):
            with open(f'data/microscope/png/{z}/{y}_{x}.png', 'wb+') as image_file:
                try:
                    image = array[y * tiles_x + x]
                    Image.fromarray(image).save(image_file, 'PNG')
                except IndexError:
                    print(f'Ouups... Index Error. Skipping (X: {x} Y: {y} Z: {z}).')
