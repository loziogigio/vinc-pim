# B2B Product Detail Page Builder

This document describes the B2B Product Detail Page Builder feature that allows B2B administrators to customize product detail pages.

## Overview

The B2B Product Detail Page Builder is a visual page builder specifically designed for customizing product detail page layouts in the B2B portal. It mirrors the functionality of the admin homepage builder but is focused on product-specific content.

## Location

**URL:** `http://localhost:3001/b2b/product-builder`

The builder can be accessed:
1. From the B2B Dashboard - via the "Product Page Builder" quick action button
2. From the B2B Catalog page - via the paintbrush icon next to each product in the products table
3. Directly via URL with optional `productId` query parameter

## Features

### Core Functionality

1. **Visual Block-Based Editor**
   - Drag-and-drop interface for adding and arranging content blocks
   - Same block library as the admin page builder
   - Real-time preview across desktop, tablet, and mobile devices

2. **Version Control**
   - Create multiple draft versions
   - Publish drafts to make them live
   - View version history
   - Duplicate and delete versions
   - Load previous versions as new drafts

3. **Product-Specific Layouts**
   - Default template: Used as a global product detail page template
   - Product-specific templates: Create custom layouts for individual products using `?productId=SKU`

4. **Publishing Workflow**
   - **Save**: Save changes to the current draft version
   - **Publish**: Publish the current draft version to make it live
   - **Hot Fix**: Update the published version directly (for urgent changes)
   - **New Version**: Start a fresh version from scratch

### Navigation

- **Back to Catalog** button in the header returns to the catalog listing
- All standard builder controls (undo/redo, device preview, settings)

## Technical Implementation

### Files Created

1. **Page Component**
   - `src/app/b2b/product-builder/page.tsx` - Main builder page component

2. **Updated Components**
   - `src/components/b2b/ProductsTable.tsx` - Added paintbrush button to launch builder
   - `src/components/b2b/QuickActionsSection.tsx` - Added quick action link

### Key Differences from Admin Builder

1. **Slug Naming Convention**
   - Default template: `product-detail`
   - Product-specific: `product-detail-{productId}` (e.g., `product-detail-SKU123`)

2. **Navigation**
   - Added "Back to Catalog" button
   - Removed "Logout" button (uses B2B layout logout)
   - Shows product ID badge when editing specific product

3. **Context**
   - Labeled as "B2B Portal - Product Detail Builder"
   - Created by "b2b-admin" instead of "admin"

## Usage Guide

### Creating a Default Product Detail Template

1. Navigate to `http://localhost:3001/b2b/product-builder`
2. Add blocks to create your default product detail page layout
3. Save and publish your changes
4. This template will be used for all products unless overridden

### Creating Product-Specific Layouts

1. Go to the B2B Catalog page
2. Click the paintbrush icon next to the product you want to customize
3. The builder opens with `?productId={SKU}`
4. Create a custom layout for this specific product
5. Save and publish

### Managing Versions

- **View History**: Click the "History" button to see all versions
- **Load Version**: Click on any version to load it as a new draft
- **Duplicate**: Create a copy of any version
- **Delete**: Remove unused draft versions

## API Endpoints Used

The product builder uses the existing page builder API endpoints:

- `GET /api/pages/{slug}` - Load page configuration
- `POST /api/pages/save-draft` - Save draft version
- `POST /api/pages/publish-draft` - Publish draft
- `POST /api/pages/hotfix` - Apply hot fix to published version
- `POST /api/pages/preview` - Generate preview
- `POST /api/pages/start-new-draft` - Start new version
- `POST /api/pages/load-version-as-draft` - Load historical version
- `POST /api/pages/duplicate-version` - Duplicate a version
- `POST /api/pages/delete-version` - Delete a version

## Best Practices

1. **Use Default Template First**: Create a solid default template before creating product-specific overrides
2. **Version Naming**: Use clear comments when creating versions to track changes
3. **Testing**: Always preview changes before publishing
4. **Hot Fixes**: Use hot fix sparingly, only for urgent live changes
5. **Clean Up**: Delete unused draft versions to keep version history clean

## Future Enhancements

Potential improvements for future iterations:

1. Product data injection in blocks (dynamic SKU, title, price, etc.)
2. Bulk template application to multiple products
3. Template inheritance system
4. A/B testing capabilities
5. Product-specific block types (reviews, related products, etc.)
6. Import/export templates
7. Template marketplace or library
