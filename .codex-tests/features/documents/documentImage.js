"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shouldCompressDocumentImage = shouldCompressDocumentImage;
exports.compressDocumentImage = compressDocumentImage;
const documentData_1 = require("./documentData");
function shouldCompressDocumentImage(file) {
    return file.type.startsWith('image/') && file.size > documentData_1.SMALL_IMAGE_SKIP_COMPRESSION_BYTES;
}
function getTargetSize(width, height) {
    const largest = Math.max(width, height);
    if (largest <= documentData_1.MAX_IMAGE_DIMENSION)
        return { width, height };
    const scale = documentData_1.MAX_IMAGE_DIMENSION / largest;
    return {
        width: Math.round(width * scale),
        height: Math.round(height * scale),
    };
}
async function loadImageBitmap(file) {
    if ('createImageBitmap' in window) {
        return createImageBitmap(file, { imageOrientation: 'from-image' });
    }
    const image = new Image();
    image.src = URL.createObjectURL(file);
    await image.decode();
    return image;
}
function canvasToBlob(canvas, type, quality) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob)
                resolve(blob);
            else
                reject(new Error('IMAGE_COMPRESSION_FAILED'));
        }, type, quality);
    });
}
async function compressDocumentImage(file) {
    const validation = (0, documentData_1.validateDocumentFile)(file);
    if (validation.ok === false)
        throw new Error(validation.message);
    if (validation.kind !== 'image' || !shouldCompressDocumentImage(file)) {
        return { file, originalFileSize: file.size, compressed: false };
    }
    const loaded = await loadImageBitmap(file);
    const sourceWidth = loaded.width;
    const sourceHeight = loaded.height;
    const target = getTargetSize(sourceWidth, sourceHeight);
    const canvas = document.createElement('canvas');
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext('2d');
    if (!context)
        throw new Error('IMAGE_COMPRESSION_FAILED');
    context.drawImage(loaded, 0, 0, target.width, target.height);
    if ('close' in loaded && typeof loaded.close === 'function') {
        loaded.close();
    }
    const outputType = file.type === 'image/png' ? 'image/webp' : file.type;
    const blob = await canvasToBlob(canvas, outputType, documentData_1.IMAGE_COMPRESSION_QUALITY);
    if (blob.size >= file.size) {
        return { file, originalFileSize: file.size, compressed: false };
    }
    const extension = outputType === 'image/webp' ? 'webp' : 'jpg';
    const outputName = file.name.replace(/\.[^.]+$/, `.${extension}`);
    const compressedFile = new File([blob], outputName, {
        type: outputType,
        lastModified: Date.now(),
    });
    return {
        file: compressedFile,
        originalFileSize: file.size,
        compressed: true,
    };
}
