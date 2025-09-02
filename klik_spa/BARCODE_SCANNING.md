# Barcode Scanning Feature

## Overview

The Klik POS system now includes a comprehensive barcode scanning feature that supports both hardware barcode scanners and camera-based scanning.

## Features

### 1. Unified Search & Barcode Scanning
- **Integrated Search Bar**: Product search and barcode scanning in one unified input field
- **Smart Detection**: Automatically detects barcodes (8+ alphanumeric characters)
- **Hardware Scanner Support**: Works seamlessly with USB/Bluetooth barcode scanners
- **Auto-processing**: Automatically processes scanned barcodes after 500ms delay, we can reduce this for faster scanning.
- **Camera Scanner**: Integrated camera button inside search bar for mobile barcode scanning

### 2. Camera-Based Scanning
- **Mobile Camera**: Live camera feed active for visual barcode scanning
- **Manual Input**: Fully functional manual barcode entry
- **Hardware Scanner Support**: Works seamlessly with USB/Bluetooth barcode scanners

### 3. Manual Input
- **Manual Entry**: Users can manually type barcode numbers
- **Auto-focus**: Input field automatically focuses when manual mode is selected

## Usage

### Desktop/Laptop
1. **Product Search**: Type product names in the search bar to filter products
2. **Barcode Scanning**:
   - **Hardware Scanner**: Simply scan any barcode into the search field (auto-processes)
   - **Camera Scanner**: Click the scanner button (📷) inside the search bar
   - **Manual Entry**: Type barcode in search field and press Enter
3. **Smart Detection**: System automatically detects barcodes (8+ alphanumeric characters)
4. **Auto-processing**: Hardware scanner input is automatically processed after 500ms

### Mobile Devices
1. **Product Search**: Type product names in the search bar to filter products
2. **Barcode Scanning**:
   - **Hardware Scanner**: Scan barcodes directly into search field
   - **Camera Scanner**: Tap the scanner button () inside the search bar
   - Grant camera permissions when prompted
   - Point camera at barcode
   - Item will be automatically added to cart upon successful scan

## Technical Implementation

### Frontend Components
- `BarcodeScanner.tsx`: Main scanner component with camera and manual input
- `SearchBar.tsx`: Updated to include scanner button
- `useBarcodeScanner.ts`: Custom hook for barcode processing logic

### Backend API
- `get_item_by_barcode`: New API endpoint for barcode lookup
- Supports both Item Barcode child table and direct item code lookup
- Returns complete item details including price and stock

### Dependencies
- `lucide-react`: Icons for UI elements

## Supported Barcode Formats
- EAN-13
- EAN-8
- UPC-A
- UPC-E
- Code 128
- Code 39

## Error Handling
- Camera permission errors
- Invalid barcode format
- Product not found
- Network connectivity issues

## User Experience
- Success notifications when items are added
- Loading states during processing
- Clear error messages
- Automatic modal closing after successful scan

## Future Enhancements
- Batch scanning for multiple items
- Barcode history
