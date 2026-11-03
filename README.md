# Cookbook

An [Obsidian](https://obsidian.md) plugin to browse your recipe notes, filter them by frontmatter properties, and generate categorised shopping lists.

## Features

- **Recipe grid** — view all your recipe notes in a card layout with cover images and frontmatter fields
- **Filters** — filter recipes by any frontmatter property; supports string matching and numeric comparisons (`<`, `=`, `>`)
- **Ingredient filters** — filter recipes by ingredient with autocomplete; supports "must contain" and "excludes" with AND/OR logic
- **Dietary group filters** — one-click filters for named ingredient groups (Dairy, Gluten, Nuts, etc.); fully customisable
- **Cook soon** — flag recipes you plan to make this week
- **Serving multiplier** — scale any recipe before generating the shopping list (×2, ×3, etc.) directly from the recipe card, detail view, or ribbon menu
- **Shopping list** — generate a categorised, grouped shopping list from your cook-soon recipes
- **Smart ingredient parsing** — quantities, units, and fractions are extracted automatically; ingredients are aggregated across recipes with unit-aware conversion
- **Custom items** — add one-off items to the shopping list manually; they're filed by your ingredient list
- **Store layouts** — give each shop numbered aisles (and move single ingredients where that shop keeps them); the list sorts itself into that shop's order
- **Drag to reorder** — rearrange shopping list categories by dragging
- **Recipe detail** — click any recipe card to read the full note rendered inside Obsidian
- **Technique tags** — tag prep on ingredient lines (`#prep/dice`, `#prep/mince`); a check command finds typos and untagged prep
- **Ingredient list** — one list where each ingredient has a category, dietary groups, other names and a staple flag; a names panel adds the ingredients your recipes use and suggests duplicates to merge
- **Cooks well with** — the recipe detail lists the recipes that share the most distinctive ingredients, and the browser can sort by overlap with your cook-together set
- **Cooking sessions** — mark recipes *cook together* and generate one note with the combined equipment, a prep list grouped by technique, every recipe's steps in a cook order you can arrange by hand, and store/reheat instructions

## How It Works

Cookbook reads notes in your vault and treats any note tagged `#recipe` (configurable) as a recipe. Frontmatter properties are used for display and filtering.

### Example recipe note

Ingredients are read from **checkboxes** (`- [ ]`) anywhere in the note body. Each checkbox line becomes one shopping list item.

```markdown
---
tags: [recipe]
title: Spaghetti Bolognese
cook-time: 45
servings: 4
cover: https://example.com/bolognese.jpg
---

## Ingredients

- [ ] 2 cloves garlic
- [ ] 500g beef mince
- [ ] 1 tin chopped tomatoes
- [ ] 200g spaghetti
- [ ] olive oil

## Steps

Your steps here...
```

Both unchecked `[ ]` and already-checked `[x]` boxes are picked up — the checked state in your note does not affect the shopping list.

#### Quantities and units

The plugin parses quantities and units from the start of each ingredient line. Supported formats:

```text
- [ ] 2 cups flour              →  2 cups flour
- [ ] 1/2 tsp salt              →  1/2 tsp salt
- [ ] 1 1/2 cups milk           →  1 1/2 cups milk
- [ ] 100g butter               →  100 g butter
- [ ] 6 Tbsp. butter            →  6 tbsp butter    (abbreviation period ignored)
- [ ] 2-3 cloves garlic         →  2 cloves garlic  (takes lower of range)
- [ ] 1 1/2 - 2 cups basil      →  1 1/2 cups basil (ranges of fractions too)
- [ ] 4 garlic cloves           →  4 cloves garlic  (trailing count unit)
- [ ] 1 (14-ounce) can milk     →  1 can milk       (size aside ignored)
- [ ] ~6 cups broccoli          →  6 cups broccoli  (strips ~ marker)
- [ ] olive oil                 →  olive oil        (no quantity)
```

Recognised units:

| Kind | Units |
| --- | --- |
| Volume | `tsp`, `tbsp`, `cup/cups`, `pt`, `qt`, `gal`, `ml`, `l`, `fl oz` |
| Weight | `g`, `kg`, `oz`, `lb/lbs` |
| Count | `clove`, `can`, `tin`, `jar`, `stick`, `bunch`, `slice`, `piece`, `package`, `pinch`, `dash`, `head`, `sprig`, `stalk`, `sheet` |

Volume and weight units convert into each other within their kind. Count units never convert — they only add up when the unit is the same, so `2 cloves` and `1 head` of garlic stay as separate lines.

#### Preparation notes

Anything after a `|` is treated as a preparation note rather than part of the ingredient name:

```text
- [ ] 1 large red onion | cut into 1-inch strips
```

A trailing comma clause is also read as preparation when it begins with a preparation word (`chopped`, `divided`, `rinsed`, `to taste`, `optional`, …):

```text
- [ ] 4 garlic cloves, chopped        →  4 cloves garlic     + note "chopped"
- [ ] 7-8 Tbsp soy sauce, to taste    →  7 tbsp soy sauce    + note "to taste"
```

Commas that are simply part of the name are left alone — `1 1/2 lbs boneless, skinless chicken breasts` keeps its full name.

Alternatives belong in parentheses: everything from ` or ` onward is dropped when matching, so write `chicken broth (or vegetable broth)` rather than `chicken or vegetable broth`, which would match as chicken.

#### Technique tags

Tag the prep a line needs with `#prep/<technique>`. Tags can go anywhere on the line; they are lifted off before parsing and shown as part of the prep note.

```text
- [ ] 2 cups butternut squash | #prep/peel #prep/dice small   →  butternut squash  + note "peel, dice · small"
- [ ] 1 medium shallot | #prep/mince                          →  medium shallot    + note "mince"
```

Techniques are a fixed list in settings (peel, halve, seed, quarter, dice, chop, mince, slice, shred, grate, zest, juice, rinse by default), in the order prep is done. Each one also lists the words that mean it, so an untagged `4 garlic cloves, minced` still counts as mince. Run **Check recipe technique tags** to find unknown tags (usually typos) and untagged prep; untagged lines can be fixed with one click.

Because they are ordinary Obsidian tags, selecting `#prep/dice` searches every recipe that dices something, and the browser offers a `technique` filter.

#### The ingredient list

Settings → **Ingredients** is the one place an ingredient is described. Each ingredient has:

- a **category** (Produce, Dairy & Eggs…), which files it on the shopping list
- **dietary groups** (Dairy, Gluten…), used by the dietary filters
- **other names** — `scallion` also answers to `green onion` and `spring onion`. Lines using any of its names merge on the shopping list, count as overlap and match ingredient filters
- a **staple** flag for things nearly every recipe uses

Search the list by name, category or tag (`Dairy`, `staple`). **Categories**, **Dietary groups** and **Staples** sit at the top of the page; renaming or deleting a category or group updates every ingredient, store aisle and the current shopping list.

**Find duplicates and missing ingredients** scans your recipes. Names that aren't in the list get an **Add** button, which creates the ingredient with a best guess at its category and groups for you to check. Likely duplicates — `apple` / `red apple`, `ceasar` / `caesar` — can be merged, which makes one name another name of the other.

#### Cooks well with

Two recipes overlap on the distinctive ingredients they share. Staples (salt, oil, dried herbs…) and the Pantry and Baking & Spices categories are ignored, since they say nothing about shopping or prepping together. Staples are set under **Ingredients → Staples**, ignored categories under **Overlap**. The recipe detail shows the top three matches with the shared ingredients, and **Sort → Overlap with cook-together set** in the browser puts the recipes that best extend your current session first.

#### Cooking sessions

Tick **cook together** on recipes you want to batch-cook (frontmatter `cook-together: true`; separate from cook-soon). **Start cooking session** in the ribbon menu, or the command, writes `Cook session YYYY-MM-DD.md` in the session folder:

- **Recipes** — a colored dot per recipe, with timings and how long each keeps
- **Equipment** — the combined `equipment` lists
- **Prep list** — one section per technique in prep order, each ingredient merged across recipes, with each recipe's dot and amount, so all the peeling happens before all the dicing
- **Cook order** — numbered steps, with *meanwhile* steps under the step they run alongside
- **Store and reheat** — from each recipe's `## Store it` and `## Reheat it` sections
- **My notes** — yours; kept when the session is regenerated

**Arranging the cook order.** Each `---` block of a recipe is one step. Starting a session opens the arrange window: drag steps (or use the arrows) into the order you'll cook them, and tick **Meanwhile** on a step to do it while the step above runs, e.g. soak the cashews while the oats bake. **Save cook order** rewrites the note. The order is stored in the note's `cook-plan` frontmatter, so regenerating keeps it; steps from new or edited recipes are added at the end. Reopen the window from the *Arrange the cook order* link at the top of the note, or the **Arrange cook order** command. Before arranging, recipes run one after another: lowest `oven-temp` first, longest `cook-time` first, stovetop last. A step moved ahead of an earlier step of its own recipe is flagged, not blocked.

The ribbon option *Also mark them cook soon* sends the same recipes to the shopping list. Optional recipe properties used here: `oven-temp`, `equipment`, `fridge-days`, `freezer-months`, `prep-time`, `cook-time`, `serving-size`.

#### Serving multiplier

Each cook-soon recipe has a `− ×1 +` stepper available on the recipe card, in the detail view, and in the ribbon menu. Setting a recipe to ×2 doubles all its quantities in the generated shopping list.

#### Aggregation across recipes

When you generate a shopping list from multiple cook-soon recipes, identical ingredients (matched case-insensitively) are **merged into a single line**:

- **Same unit** — quantities are summed directly (`1 cup flour` + `2 cups flour` = `3 cups flour`)
- **Different units, same type** — converted to a common base and summed (`1 cup milk` + `4 tbsp milk` ≈ `1 1/4 cups milk`)
- **Incompatible units** (e.g. cups vs grams) — kept as separate entries
- **No unit** — aggregated by name only
- The source recipe titles are **combined** and shown as a label under the item so you know where it came from

Names are compared after stripping wikilinks, parentheticals and leading descriptors, so `shredded cheddar cheese` and `cheddar cheese` become one line. The wording of whichever line came first is what you see.

#### Categorising items

A line is filed by the ingredient it names. A line that is exactly an ingredient's name (or another name) is that ingredient; otherwise the **longest** ingredient name found in it wins, matching whole words only.

That is what keeps `full-fat coconut milk` in **Pantry** (`coconut milk` is longer than `milk`) and `horseradish cheddar cheese` in **Dairy & Eggs** (`radish` doesn't match inside `horseradish`). Lines only merge when they name the same ingredient exactly, so `blueberries` and `raspberries` stay two lines.

Items that match no ingredient fall into **Uncategorized** at the bottom of the list.

### Filtering recipes

The recipe browser supports multiple filter types that can be combined:

**Frontmatter filters** — filter by any property on your recipe notes. String properties use exact match; numeric properties support `<`, `=`, `>`.

**Ingredient filters** — search for recipes that must contain (or exclude) a specific ingredient. Type to get autocomplete suggestions drawn from your actual recipe notes. Multiple ingredients can be added to a single filter, with an AND/OR toggle to control how they combine.

**Dietary group filters** — pre-built groups let you filter by broad ingredient categories with a single click:

| Group | Examples |
| --- | --- |
| Dairy | milk, butter, cream, cheese, yogurt… |
| Meat & Poultry | chicken, beef, pork, bacon, lamb… |
| Fish | salmon, tuna, cod, anchovy, haddock… |
| Shellfish | shrimp, prawn, crab, mussel, scallop… |
| Eggs | egg, egg white, mayonnaise, meringue |
| Tree Nuts | almond, walnut, cashew, pistachio… |
| Peanuts | peanut, peanut butter, satay… |
| Soy | soy sauce, tofu, tempeh, edamame, miso… |
| Sesame | sesame, tahini, sesame oil, halva… |
| Gluten | flour, wheat, bread, pasta, barley… |

Fish and shellfish are separate groups, as are tree nuts and peanuts — they are distinct allergens, and someone reacting to shrimp can still eat salmon.

#### Look-alikes and "free-from"

Every ingredient named in a line counts towards its dietary groups, so `butter and almonds` is both Dairy and Tree Nuts. A name that sits inside a longer one doesn't count: `coconut milk`, `peanut butter` and `rice noodles` are ingredients of their own, without Dairy or Gluten, so they keep `milk`, `butter` and `noodle` from matching.

A line that says it's free of a group — `gluten-free flour`, `dairy-free yogurt` — doesn't count for that group. The group's name is the word, so no list is needed.

Add, rename or remove dietary groups under **Ingredients → Dietary groups**, and tag ingredients on the Ingredients page. You can also use frontmatter flags on individual recipes (e.g. `isVegan: true`) and filter on those directly using the frontmatter filter.

### Using the plugin

1. Click the **utensils icon** in the ribbon to open the quick-access menu
2. Select **Browse recipes** to browse and filter your recipes
3. Mark recipes as **Cook soon** using the checkbox on each card or in the detail view
4. Optionally adjust the **serving multiplier** (`− ×1 +`) on any cook-soon recipe to scale its quantities
5. Back in the ribbon menu, click **Generate Shopping List** to build a shopping list from your cook-soon recipes
6. The **Shopping List** panel opens in the right sidebar — check off items as you shop

**Ribbon menu** — shows your cook-soon recipes and quick actions:

![Ribbon menu](docs/ribbon-icon-modal.png)

**Recipe browser** — filter and browse your recipes in a card grid:

![Cookbook browser](docs/cookbook-modal.png)

**Shopping list** — categorised ingredients from your cook-soon recipes:

![Shopping list](docs/shopping-list.png)

## Commands

| Command | Description |
| --- | --- |
| **Browse recipes** | Opens the recipe browser |
| **Open shopping list** | Opens the shopping list sidebar panel |
| **Start cooking session** | Writes today's session note for the cook-together recipes and opens the arrange window |
| **Arrange cook order** | Rearranges the steps of the open session note |
| **Check recipe technique tags** | Lists unknown technique tags and untagged prep |

## Settings

### Properties to display

A comma-separated list of frontmatter properties to show on each recipe card (e.g. `title, cook-time, servings, cover`).

### Recipes folder

Restrict recipe scanning to a specific folder. Defaults to the entire vault.

### Recipes tag

The tag that identifies a note as a recipe. Defaults to `#recipe`.

### Cook-soon property

The frontmatter key used to mark a recipe as cook-soon. Defaults to `cook-soon`. Change this if your vault already uses a different key.

### Cover image property

The frontmatter key holding each recipe's cover image. Defaults to `cover`. The value can be a URL, a vault-relative path, a wikilink (`[[cover.png]]`) or a markdown image — all of them resolve to the right picture on the recipe card and in the detail view.

### Ignore paths

A list of folders or files to exclude from recipe scanning. Useful for template folders or example notes.

### Hide checked items

When enabled, checking off a shopping list item removes it from the list immediately instead of showing a strikethrough. Useful for a cleaner shopping experience.

### Preferred volume unit / preferred weight unit

Choose which unit to use when displaying aggregated volume or weight quantities on the shopping list (e.g. prefer `cups` over `ml`). Defaults to auto, which uses whichever unit appears first.

### Ingredients

The ingredient list (see [The ingredient list](#the-ingredient-list)), with three pages at the top:

- **Categories** — names only, with how many ingredients use each. Default categories, in default walking order: Produce, Bakery, Deli, Meat & Fish, Dairy & Eggs, Pantry, Baking & Spices, Condiments & Sauces, Drinks, Frozen, Household & Other. **Household & Other** catches non-food items you add by hand, such as toothpaste. You can also create a category from any ingredient's **Category** dropdown.
- **Dietary groups** — names only. Ten are pre-configured, with fish and shellfish, and tree nuts and peanuts, kept apart as distinct allergens.
- **Staples** — every staple as one block; removing one clears that ingredient's **Staple** switch.

The list button above the ingredients adds any starter ingredients you don't have, which is also how you pick up additions from a plugin update.

### Store layouts

A store layout says *where things are in one shop*; categories say *what* an ingredient is. Open a store to set it up:

- **Numbered aisles** — give an aisle a number, pick the categories shelved there, and under **Also here** pick single ingredients this shop keeps there whatever their category (soy sauce in International, say). On the shopping list, numbered aisles come first, in number order.
- **Categories not in an aisle** — everything else, in the order you walk it. Drag to reorder here, or drag categories in the shopping list itself; the order is saved into the active store.

A store with no numbered aisles is simply its category order. With more than one store, a picker appears in the shopping list header and switching re-sorts the list. **Duplicate store** is the quick way to start a new shop from one you already know.

### Cooking sessions

The cook-together property (default `cook-together`) and the folder session notes are written to (default `recipes/cook sessions`).

### Prep techniques

The technique tag prefix (default `prep`) and the ordered technique list. Order is prep order; keywords are the untagged words that count as the technique.

### Overlap

**Ignored categories** — categories whose ingredients are left out of overlap scoring. Staples are set under **Ingredients → Staples**.

## Upgrading to 2.0

2.0 replaces the separate keyword lists (category keywords, dietary keywords and exclusions, aliases, staples) with the ingredient list. Your settings are converted once, the first time 2.0 loads:

- every keyword becomes an ingredient, tagged so that each recipe line is filed, grouped and flagged exactly as before
- the old lists are kept in the plugin's `data.json` under `legacyKeywordLists`

Because the old lists were matched as words, some tags carry over from shorter words inside longer names — `peanut butter` marked staple through `butter`, for example. They behaved that way before too; now they're visible, and **Ingredients → Staples** is the quickest place to tidy them.

**Update the plugin on every device you sync.** An older version reading 2.0 settings files everything as Uncategorized, and keyword edits made there are not picked up by 2.0.

## Installation

### Community plugins (recommended)

1. Open Obsidian Settings → Community plugins
2. Search for **Cookbook**
3. Click Install, then Enable

### Manual

1. Download `main.js`, `styles.css`, and `manifest.json` from the [latest release](../../releases/latest)
2. Copy them to `<your vault>/.obsidian/plugins/cookbook/`
3. Enable the plugin in Obsidian Settings → Community plugins

## Support

Always wondered if I could make a dollar from a project. If you find this plugin useful, you can support development here:

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-yellow)](https://buymeacoffee.com/digon)
