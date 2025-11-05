# CSS Variables Architecture

The CSS variables have been organized into modular files for better maintainability and scalability.

## File Structure

```
src/mainstyles/
├── main.css                    # Main stylesheet with imports and global styles
└── variables/
    ├── colors.css              # Color palette (10 variables)
    ├── spacing.css             # Spacing system (9 variables)
    ├── borders.css             # Border widths & radius (7 variables)
    ├── typography.css          # Font sizes (11 variables)
    ├── icons.css               # Icon sizes (4 variables)
    ├── layout.css              # Positioning & component sizes (13 variables)
    ├── zindex.css              # Z-index scale (7 variables)
    └── transitions.css         # Animation speeds (3 variables)
```

## Variable Categories

### 🎨 Colors (`colors.css`)

- **Primary Colors**: `--primary-dark`, `--primary-medium`, `--primary-light`
- **Accent Colors**: `--accent-gold`, `--accent-red`
- **Text Colors**: `--text-light`, `--text-dark`, `--parchment`
- **Shadow Colors**: `--shadow-dark`, `--shadow-light`

### 📏 Spacing (`spacing.css`)

- Base unit: 4px
- Scale: `--space-xs` (4px) to `--space-5xl` (60px)
- Usage: padding, margin, gaps

### 🔲 Borders (`borders.css`)

- **Widths**: `--border-thin` (1px), `--border-normal` (2px), `--border-thick` (3px)
- **Radius**: `--radius-sm` to `--radius-lg`, `--radius-circle` (50%)

### 📝 Typography (`typography.css`)

- Scale: `--font-xs` (0.75rem) to `--font-6xl` (3.75rem)
- Special: `--font-base` (1rem), `--font-md` (1.25rem)
- Usage: Responsive font sizing

### ⭐ Icons (`icons.css`)

- Pixel-based sizes for precise control
- Range: `--icon-sm` (32px) to `--icon-xl` (120px)
- Usage: Decorative elements, star ratings, badges

### 📐 Layout (`layout.css`)

- **Pseudo Offsets**: Precise positioning for decorative elements
- **Decorator Gaps**: Star/sword spacing around titles
- **Button Padding**: Standardized button sizes

### 🗂️ Z-Index (`zindex.css`)

- Layering hierarchy from -1 to 2000
- Specific layers: header (111), modal (1000), toast (2000)

### ⚡ Transitions (`transitions.css`)

- Animation speeds: fast (0.2s), normal (0.3s), slow (0.5s)
- Usage: Hover effects, state changes

## Usage

### In Component CSS Files

Simply import the main.css file which already includes all variables:

```css
@import '../../mainstyles/main.css';

.my-component {
  padding: var(--space-md);
  color: var(--accent-gold);
  font-size: var(--font-lg);
}
```

### Importing Specific Variable Files

If you only need specific variable categories:

```css
@import '../../mainstyles/variables/colors.css';
@import '../../mainstyles/variables/spacing.css';

.minimal-component {
  background: var(--primary-dark);
  padding: var(--space-lg);
}
```

## Benefits

✅ **Modularity**: Each concern is separated into its own file
✅ **Maintainability**: Easy to update specific variable categories
✅ **Scalability**: Add new variables without cluttering main.css
✅ **Documentation**: Clear organization makes variables discoverable
✅ **Performance**: No impact - CSS imports are resolved at build time
✅ **Type Safety**: Consistent naming conventions across categories

## Naming Conventions

- **Colors**: `--{category}-{variant}` (e.g., `--primary-dark`)
- **Spacing**: `--space-{size}` (e.g., `--space-md`)
- **Typography**: `--font-{size}` (e.g., `--font-xl`)
- **Icons**: `--icon-{size}` (e.g., `--icon-lg`)
- **Z-index**: `--z-{layer}` (e.g., `--z-modal`)

## Adding New Variables

1. Choose the appropriate category file
2. Add the variable following the naming convention
3. Update this documentation
4. Test in relevant components

Example:

```css
/* In colors.css */
--accent-blue: #4a7c9b; /* New accent color */
```

## Migration Notes

- All existing components continue to work without changes
- Variables are auto-imported through main.css
- No breaking changes to the public API
- Build time remains the same (imports resolved by webpack)
