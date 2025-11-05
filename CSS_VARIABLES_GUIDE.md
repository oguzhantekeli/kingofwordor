# CSS Variables Guide - King of Wordor

This document provides a comprehensive guide to the standardized CSS variable system implemented across the King of Wordor codebase.

## Overview

A complete design token system has been implemented to ensure consistency, maintainability, and easy customization across all components. All hardcoded values have been replaced with semantic CSS custom properties (variables).

## Variable Categories

### 1. Spacing Scale (4px base increment)

```css
--space-xs: 4px /* Extra small - borders, tight gaps */ --space-sm: 10px
  /* Small - compact padding */ --space-md: 20px
  /* Medium - standard padding/margins */ --space-lg: 15px
  /* Large - section spacing */ --space-xl: 25px
  /* Extra large - major spacing */ --space-2xl: 30px
  /* 2X large - component padding */ --space-3xl: 40px
  /* 3X large - section padding */ --space-4xl: 50px /* 4X large - major gaps */
  --space-5xl: 60px /* 5X large - maximum spacing */;
```

**Usage:**

- Use for padding, margins, gaps
- Use in calc() for negative values: `calc(-1 * var(--space-md))`

### 2. Typography Scale

```css
--font-xs: 0.75rem /* 12px - mobile small text */ --font-sm: 0.9rem
  /* 14.4px - small UI text */ --font-base: 1rem /* 16px - body text */
  --font-md: 1.25rem /* 20px - medium emphasis */ --font-lg: 1.2rem
  /* 19.2px - large UI text */ --font-xl: 1.5rem /* 24px - headings */
  --font-2xl: 1.8rem /* 28.8px - major headings */ --font-3xl: 2rem
  /* 32px - large headings */ --font-4xl: 2.5rem /* 40px - hero text */
  --font-5xl: 4rem /* 64px - display text */ --font-6xl: 3.75rem
  /* 60px - maximum display */;
```

### 3. Icon & Decorator Sizes

```css
--icon-sm: 32px /* Small icons */ --icon-md: 36px /* Medium icons */
  --icon-lg: 28px /* Large icons */ --icon-xl: 120px /* Extra large (avatars) */
  --decorator-gap-sm: 20px /* Small decorator gap */ --decorator-gap-md: 25px
  /* Medium decorator gap */ --decorator-gap-lg: 30px /* Large decorator gap */
  --decorator-gap-xl: 35px /* Extra large decorator gap */;
```

**Usage for decorators:**

```css
.element::before {
  left: calc(-1 * var(--decorator-gap-lg));
}
```

### 4. Border Widths

```css
--border-thin: 1px /* Subtle borders */ --border-normal: 2px
  /* Standard borders */ --border-thick: 3px /* Emphasized borders */;
```

### 5. Button Padding

```css
--button-padding-sm: 6px 12px /* Compact buttons */ --button-padding-md: 12px
  20px /* Standard buttons */ --button-padding-lg: 18px 60px
  /* Large action buttons */ --button-padding-xl: 20px 50px
  /* Extra large buttons */;
```

### 6. Z-Index Scale

```css
--z-below: -1 /* Behind normal content */ --z-base: 10
  /* Base elevated content */ --z-header: 111 /* Fixed header */ --z-modal: 1000
  /* Modal overlays */ --z-toast: 2000 /* Toast notifications */;
```

### 7. Transitions

```css
--transition-fast: 0.2s /* Quick interactions */ --transition-normal: 0.3s
  /* Standard transitions */ --transition-slow: 0.4s /* Smooth, noticeable */;
```

### 8. Color Palette

```css
/* Primary Colors */
--primary-dark: #2c1c0c /* Dark brown */ --primary-medium: #3a3223
  /* Medium brown */ --primary-light: #5a3a1a /* Light brown */
  /* Parchment Backgrounds */ --parchment: #f4ecd8 /* Main parchment */
  --parchment-dark: #e8dcc4 /* Darker parchment */ /* Accent Colors */
  --accent-gold: #c9a66b /* Primary gold */ --accent-red: #872e2e
  /* Action red */ /* Text Colors */ --text-dark: #3a3223 /* Dark text */
  --text-light: #f4ecd8 /* Light text */ /* Shadows */
  --shadow-dark: rgba(0, 0, 0, 0.5) --shadow-light: rgba(201, 166, 107, 0.4);
```

## Common Usage Patterns

### Centering Pseudo-Elements

When centering decorative elements relative to their parent:

```css
.element::before {
  position: absolute;
  top: calc(-1 * var(--icon-lg) - var(--space-sm));
  left: 50%;
  transform: translateX(-50%);
}
```

### Responsive Spacing

```css
@media (max-width: 768px) {
  .container {
    padding: var(--space-lg) var(--space-md);
    gap: var(--space-sm);
  }
}
```

### Box Shadows

```css
.card {
  box-shadow: 0 var(--space-xs) var(--space-lg) var(--shadow-dark);
}

.card:hover {
  box-shadow: 0 var(--space-sm) var(--space-2xl) var(--shadow-dark);
}
```

### Text Shadows

```css
.title {
  text-shadow: 0 0 var(--space-sm) var(--shadow-dark);
}
```

## Files Updated

The following files have been migrated to the CSS variable system:

1. **`/src/mainstyles/main.css`** - Variable definitions and global styles
2. **`/src/components/endgame/endgame.css`** - End game results screen
3. **`/src/components/welcome/welcome.css`** - Welcome and game selection
4. **`/src/components/board/board.css`** - Game board layout
5. **`/src/components/header/header.css`** - Fixed navigation header
6. **`/src/components/settings/settings.css`** - Settings page
7. **`/src/components/settings/settingsModal.css`** - Settings modal
8. **`/src/components/toast/toast.css`** - Toast notifications
9. **`/src/components/board/answerinput/AnswerInput.css`** - Input field

## Benefits

✅ **Consistency** - All spacing follows the 4px base increment system  
✅ **Maintainability** - Update variables once, apply everywhere  
✅ **Scalability** - Easy to add new sizes or adjust the scale  
✅ **Readability** - Semantic names make code self-documenting  
✅ **Responsive** - Variables work seamlessly in media queries  
✅ **Calculation-friendly** - Works with calc() for complex positioning

## Migration Checklist

When adding new components or styles:

- [ ] Use spacing variables instead of hardcoded px values
- [ ] Use typography scale for all font-size declarations
- [ ] Use z-index scale for layering
- [ ] Use border width variables
- [ ] Use color variables from the palette
- [ ] Use transition variables for animations
- [ ] Use calc() with variables for negative positioning

## Examples

### Before (Hardcoded)

```css
.button {
  padding: 12px 20px;
  font-size: 1.2rem;
  border: 2px solid #c9a66b;
  margin-top: 15px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.5);
}
```

### After (Variables)

```css
.button {
  padding: var(--button-padding-md);
  font-size: var(--font-lg);
  border: var(--border-normal) solid var(--accent-gold);
  margin-top: var(--space-lg);
  box-shadow: 0 var(--space-xs) var(--space-lg) var(--shadow-dark);
}
```

## Future Enhancements

Consider adding:

- Animation duration variables
- Breakpoint variables
- Opacity scale
- Border-radius scale
- Letter-spacing scale

---

**Last Updated:** 2024  
**Maintained by:** Development Team
