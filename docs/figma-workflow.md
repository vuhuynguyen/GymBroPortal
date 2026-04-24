---
name: Figma Make to Angular - Generic Workflow
description: Universal process for converting any Figma Make React export to Angular, using design system patterns
type: feedback
---

# Generic Figma-to-Angular Workflow

**Use this for ANY Figma Make export, not just exercise forms.**

---

## 📖 Prerequisites

Before starting, read:
1. **`DESIGN_SYSTEM_GUIDE.md`** - Complete styling and pattern reference
2. **`src/styles.scss`** - Available `inv-*` tokens
3. **`src/app/shared/ui/`** - Available shared components

---

## Step 1: Extract Visual Intent (Not Code)

**Goal:** Understand WHAT the design looks like, not HOW to code it.

### Read from React Export:

**Layout Structure** (`App.tsx`):
- [ ] Page layout (sidebar + main, full-width, multi-column)
- [ ] Section ordering (top to bottom)
- [ ] Spacing hierarchy (gaps between sections)
- [ ] Responsive breakpoints (mobile, tablet, desktop)
- [ ] Sticky elements (sidebars, headers, footers)

**Component Patterns** (`App.tsx` + UI components):
- [ ] Card patterns (header+body, plain, nested)
- [ ] Form field groupings (single column, 2-column grid, inline)
- [ ] List patterns (static, dynamic with add/remove, chips)
- [ ] Interactive elements (buttons, dropdowns, inputs)
- [ ] Empty states (what shows when lists are empty)
- [ ] Preview panels (live preview, summary cards)

**Visual Hierarchy**:
- [ ] Text sizes (page title, section title, body, helper)
- [ ] Color usage (primary actions, status indicators, badges)
- [ ] Icon usage (where icons appear, what they represent)
- [ ] Borders, shadows, rounded corners

**Data Patterns**:
- [ ] What fields are required vs. optional
- [ ] Character limits (check placeholders, labels)
- [ ] Validation hints (error messages, format hints)
- [ ] Default values (pre-filled content)

### Check for Spec Docs:
- [ ] Look in `docs/_figma-*/` for `.md` spec files
- [ ] Read spec for: field limits, behaviors, edge cases, section ordering

### ❌ DO NOT:
- Translate JSX syntax to Angular
- Copy `theme.css` colors (use `inv-*` tokens instead)
- Import React libraries
- Copy inline styles or arbitrary values

---

## Step 2: Map to Design System

**Goal:** Match visual patterns to existing Angular components and tokens.

### 2.1 Color Mapping

**For each colored element**, ask:

1. **What is its semantic purpose?**
   - Primary action → `inv-primary-*`
   - Success/beginner → `inv-success-*`
   - Warning/draft → `inv-warning-*`
   - Error/delete → `inv-danger-*`
   - Info/intermediate → `inv-info-*`
   - Advanced → `inv-purple-*`
   - Tags/labels → `inv-indigo-*`

2. **Check `DESIGN_SYSTEM_GUIDE.md` → Color System**

3. **Verify token exists in `src/styles.scss`**

**Rule:** No hex colors in feature code. Only `inv-*` tokens.

### 2.2 Component Mapping

**For each visual element**, check `DESIGN_SYSTEM_GUIDE.md → Component Patterns`:

| If You See... | Use This Component |
|---------------|-------------------|
| Card with title + content | `<app-ui-panel-card title="...">` |
| Removable pills/chips | `<app-chip-removable-list [items]="..." [color]="...">` |
| Text field + button inline | `<app-ui-form-inline>` |
| Text input | `<app-input>` wrapped in `<app-form-field>` |
| Dropdown/select | `<app-select>` wrapped in `<app-form-field>` |
| Multiline text | `<app-textarea>` wrapped in `<app-form-field>` |
| Button | `<app-button variant="...">` |
| Dashed "add more" button | Custom button with `border-2 border-dashed` |
| Empty state message | `<div *ngIf="items.length === 0" class="...">` |

**Rule:** Never use raw PrimeNG components. Always use shared wrappers.

### 2.3 Spacing Mapping

**Check `DESIGN_SYSTEM_GUIDE.md → Spacing System`**:

- Between cards/sections → `gap-6` (24px)
- Inside cards → `gap-4` (16px)
- Grid columns → `lg:gap-8` (32px)
- Inline elements → `gap-2` (8px)
- Card padding → `p-6`
- Page container → `px-8 py-8`

**Rule:** Use standard spacing. No arbitrary values unless absolutely necessary.

### 2.4 Typography Mapping

**Check `DESIGN_SYSTEM_GUIDE.md → Typography Scale`**:

- Page title → `text-3xl font-semibold`
- Section title → `text-lg font-semibold`
- Body text → `text-sm`
- Helper text → `text-sm text-gray-500`
- Labels → `text-sm font-medium text-gray-700`

---

## Step 3: Recognize Behavioral Patterns

**Goal:** Identify interaction patterns and apply correct behavior.

### Dynamic List Patterns

**Pattern 1: Always One Row** (e.g., form steps, media URLs)
- ✅ Can add unlimited rows (up to limit)
- ✅ Can remove rows, but **never goes to zero**
- ✅ Removing last row **clears content**, doesn't delete row
- 📝 Example: Instructions, Training Media

**Pattern 2: Can Be Empty** (e.g., tags, warnings)
- ✅ Can add items up to limit
- ✅ Can remove all items
- ✅ Show empty state when zero items
- 📝 Example: Tags, Warnings, Secondary Muscles

**Pattern 3: Duplicate Prevention** (e.g., tags)
- ✅ Check before adding (case-insensitive)
- ✅ Ignore duplicate attempts silently
- 📝 Example: Tags

**Pattern 4: Enter Key Submit** (e.g., tags)
- ✅ Enter key triggers add action
- ✅ Clears input after adding
- 📝 Example: Tag input fields

**Check `DESIGN_SYSTEM_GUIDE.md → Dynamic List Patterns` for code examples**

### Form Validation Patterns

**Required Fields:**
- Red asterisk in label: `<span class="text-red-500">*</span>`
- Validate on submit (not on blur)
- Show errors inline after submit attempt

**Character Limits:**
- Show counter for any field with limit
- Format: `{{ value.length }}/{{ maxLength }}`
- Position: Next to label or below field
- Color: `text-xs text-gray-400`

**Field Limits (common defaults, check spec for actual):**
- Name/Title: 200 chars
- Short description: 500 chars
- Long description: 1000-2000 chars
- Tag/Label: 50 chars
- URL: 500 chars
- Step/Instruction: 1000 chars

---

## Step 4: Build Layout Structure

**Goal:** Implement responsive layout with Tailwind utilities.

### 4.1 Choose Layout Pattern

**Check `DESIGN_SYSTEM_GUIDE.md → Layout Patterns`**

**Two-Column Form + Preview:**
```html
<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
  <div class="lg:col-span-2 space-y-6"><!-- Main --></div>
  <div class="lg:col-span-1">
    <div class="sticky top-8"><!-- Sidebar --></div>
  </div>
</div>
```

**Full-Width with Filters:**
```html
<div class="space-y-6">
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4"><!-- Stats --></div>
  <div class="bg-white rounded-xl border p-4"><!-- Filters --></div>
  <div class="bg-white rounded-xl border"><!-- Table --></div>
</div>
```

### 4.2 Implement Form Structure

**Always use Reactive Forms:**
```typescript
export class FeatureComponent implements OnInit {
  form: FormGroup;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(200)]],
      description: ['', Validators.required],
      // For dynamic lists:
      items: this.fb.array([]),
      // For simple fields:
      type: [''],
    });
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  addItem(): void {
    this.items.push(this.fb.control(''));
  }
}
```

### 4.3 Add Responsive Breakpoints

**Mobile-first approach:**
```html
<!-- Stack on mobile, side-by-side on desktop -->
<div class="flex flex-col lg:flex-row gap-4">

<!-- 1 column mobile, 2 tablet, 3 desktop -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

<!-- Full width mobile, constrained desktop -->
<div class="w-full lg:max-w-7xl lg:mx-auto px-4 lg:px-8">
```

### 4.4 Add Fixed Elements (if needed)

**Sticky Sidebar:**
```html
<div class="sticky top-8">
  <!-- Sidebar content -->
</div>
```

**Fixed Action Bar:**
```html
<!-- Spacer at end of content -->
<div class="h-24"></div>

<!-- Fixed bar -->
<div class="fixed bottom-0 left-[sidebar-width] right-0 bg-white border-t shadow-sm z-10">
  <div class="max-w-7xl mx-auto px-8 py-4">
    <div class="flex items-center justify-between">
      <!-- Status + Actions -->
    </div>
  </div>
</div>
```

**Check `DESIGN_SYSTEM_GUIDE.md → Fixed Action Bar Pattern` for details**

---

## Step 5: Implement Interactive Behaviors

**Goal:** Add correct interaction logic for all patterns.

### 5.1 Dynamic Lists

**For "Always One Row" pattern:**
```typescript
removeItem(index: number): void {
  if (this.items.length === 1) {
    this.items.at(0).setValue(''); // Clear, don't delete
  } else {
    this.items.removeAt(index);
  }
}
```

**For "Can Be Empty" pattern:**
```typescript
removeItem(index: number): void {
  this.items.removeAt(index);
}
```

**For "Duplicate Prevention" pattern:**
```typescript
addTag(): void {
  const normalized = this.newTag.trim().toLowerCase();
  if (this.tags.some(tag => tag.toLowerCase() === normalized)) {
    return; // Duplicate
  }
  this.tags.push(this.newTag.trim());
  this.newTag = '';
}
```

### 5.2 Character Counters

**In template:**
```html
<app-textarea 
  [formControl]="descriptionControl"
  [maxlength]="1000">
</app-textarea>
<span class="text-xs text-gray-400">
  {{ descriptionControl.value?.length || 0 }}/1000
</span>
```

### 5.3 Empty States

**Always provide empty state:**
```html
<div *ngIf="items.length === 0" class="text-center py-8">
  <lucide-icon name="inbox" class="w-12 h-12 mx-auto mb-2 text-gray-400"></lucide-icon>
  <p class="text-sm text-gray-500 italic">No items yet</p>
</div>
```

### 5.4 Preview "+N More"

**For truncated previews:**
```html
<div *ngFor="let item of items.slice(0, maxPreview)">
  {{ item }}
</div>
<p *ngIf="items.length > maxPreview" class="text-xs text-gray-400">
  +{{ items.length - maxPreview }} more
</p>
```

---

## Step 6: Apply Visual Polish

**Goal:** Match design system styling exactly.

### 6.1 Badge/Chip Colors

**Check `DESIGN_SYSTEM_GUIDE.md → Badge/Chip Colors`**

Common patterns:
- Difficulty badges → Green (beginner) / Blue (intermediate) / Purple (advanced)
- Status badges → Emerald (active) / Amber (draft) / Gray (archived)
- Media type → Blue (image) / Purple (video)

```html
<span 
  [class]="'px-2.5 py-1 rounded-lg text-xs font-medium ' + getBadgeColor(item)">
  {{ item }}
</span>
```

### 6.2 Focus States

**All interactive elements need focus ring:**
```html
class="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
```

### 6.3 Transitions

**Add smooth transitions:**
```html
class="transition-colors hover:bg-gray-50"
```

### 6.4 Accessibility

**Required checks:**
- [ ] All form fields have labels
- [ ] Required fields marked with `*`
- [ ] Error messages have proper color contrast
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Focus states are visible
- [ ] Color is not the only indicator of state

---

## Step 7: Verify Implementation

**Goal:** Ensure everything works correctly before marking complete.

### 7.1 Build Verification

```bash
# Clear Angular cache
rm -rf .angular/cache

# Restart dev server
ng serve

# Hard refresh browser
Cmd+Shift+R (Mac) / Ctrl+Shift+R (Windows)

# Build to verify Tailwind classes
ng build
```

**Check:**
- [ ] All Tailwind classes appear in compiled CSS
- [ ] `inv-*` tokens resolve to actual colors
- [ ] No console errors
- [ ] No TypeScript errors

### 7.2 Functional Testing

**Test all interactive behaviors:**
- [ ] Add item to dynamic list (up to limit)
- [ ] Remove item from dynamic list
- [ ] Remove last item (clears vs. deletes based on pattern)
- [ ] Character limits enforce correctly
- [ ] Duplicate prevention works (if applicable)
- [ ] Enter key submission works (if applicable)
- [ ] Form validation triggers correctly
- [ ] Empty states appear when appropriate
- [ ] Preview updates in real-time (if applicable)
- [ ] Required field validation works
- [ ] Submit button disabled when form invalid

### 7.3 Responsive Testing

**Test at breakpoints:**
- [ ] Mobile (375px width)
- [ ] Tablet (768px width)
- [ ] Desktop (1024px width)
- [ ] Wide (1440px width)

**Check:**
- [ ] Layout stacks/reflows correctly
- [ ] Sticky elements work on desktop only
- [ ] Text doesn't overflow
- [ ] Buttons remain accessible
- [ ] Touch targets large enough on mobile (min 44px)

### 7.4 Visual QA

**Compare to Figma:**
- [ ] Spacing matches design system (not pixel-perfect to Figma)
- [ ] Colors use `inv-*` tokens consistently
- [ ] Typography matches scale
- [ ] Components match shared UI library
- [ ] Borders, shadows, corners consistent

**Rule:** Match the **system**, not the Figma export pixels.

---

## Step 8: Document Deviations (if any)

**If you had to deviate from the design system:**

1. **Document why:** Comment in code explaining the deviation
2. **Check with user:** Ask if new pattern should be added to design system
3. **Consider generalization:** Could this become a shared component?

**Example:**
```typescript
// Using custom color here because this status is unique to this feature
// and doesn't map to existing inv-* semantic tokens.
// TODO: Consider adding inv-pending token to design system if reused.
```

---

## Quick Reference Checklist

**Before you start:**
- [ ] Read `DESIGN_SYSTEM_GUIDE.md`
- [ ] Check `src/styles.scss` for available tokens
- [ ] Check `src/app/shared/ui/` for components
- [ ] Look for spec docs in `docs/_figma-*/`

**While implementing:**
- [ ] Extract visual intent (Step 1)
- [ ] Map to design system (Step 2)
- [ ] Recognize patterns (Step 3)
- [ ] Build layout (Step 4)
- [ ] Add behaviors (Step 5)
- [ ] Apply styling (Step 6)
- [ ] Verify everything (Step 7)

**Design system rules:**
- [ ] No hex colors (only `inv-*` tokens)
- [ ] No raw PrimeNG (use shared wrappers)
- [ ] Use Reactive Forms (never template-driven)
- [ ] Follow spacing system (gap-6, gap-4, gap-8)
- [ ] Reuse shared components
- [ ] Match system > match Figma pixels

---

## When to Ask for Help

**Ask the user when:**
- No existing `inv-*` token matches the color need
- Visual pattern doesn't match any shared component
- Behavior is ambiguous (e.g., unclear if list can be empty)
- Spec doc is missing or unclear
- Character limits not specified
- Multiple valid interpretations exist

**Don't ask when:**
- Answer is in `DESIGN_SYSTEM_GUIDE.md`
- Pattern exists in `src/app/shared/ui/`
- Similar feature already implemented (check existing code)
- Standard Tailwind utilities apply

---

## Anti-Patterns to Avoid

❌ **Don't:**
- Convert JSX syntax directly to Angular
- Copy React component names/structure
- Use arbitrary Tailwind values without checking spacing system
- Create new components when shared ones exist
- Skip empty states
- Forget character counters on limited fields
- Use template-driven forms
- Hardcode colors (use `inv-*` tokens)
- Ignore responsive breakpoints
- Skip accessibility checks

✅ **Do:**
- Extract design intent first
- Map to existing patterns
- Use shared components consistently
- Follow spacing system
- Implement proper validation
- Test all edge cases
- Use Reactive Forms
- Add proper focus states
- Test responsive behavior
- Document deviations

---

**Remember:** The React export is a **visual reference**, not a code template. Build using Angular patterns, design system tokens, and shared components. Consistency beats pixel-perfection.
