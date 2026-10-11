import type { CookbookSettings } from "./index";

/**
 * Keyword lists are matched whole-word (see ingredients/categorize.ts), so
 * compound names such as "blueberries" need their own entry — a bare "berry"
 * no longer matches inside a longer word.
 *
 * Two separate lists live here and they answer different questions:
 *   ingredientGroups   — "does this recipe contain dairy?"  (dietary tags,
 *                        several may apply at once, order irrelevant)
 *   shoppingCategories — "which aisle is this in?"          (exactly one per
 *                        item, and the order is the walking route)
 */
export const DEFAULT_SETTINGS: CookbookSettings = {
	propsToShow: ["title"],
	shoppingListFilePath: undefined,
	coverProp: "cover",
	recipesFolder: ".",
	recipesTag: "#recipe",
	cookSoonProp: "cook-soon",
	ignorePaths: [],
	hideCheckedItems: false,

	// Dietary groups. `excludeKeywords` carries the terms that look like a match
	// but are not one — plant milks are not dairy, rice noodles are not gluten.
	ingredientGroups: [
		{
			name: "Dairy",
			keywords: ["milk", "butter", "cream", "cheese", "yogurt", "yoghurt", "parmesan", "mozzarella", "cheddar", "gruyere", "brie", "feta", "ricotta", "ghee", "creme fraiche", "crème fraîche", "sour cream", "mascarpone", "whipping cream", "double cream", "single cream", "half and half", "cream cheese", "custard", "buttermilk", "curd"],
			excludeKeywords: ["coconut milk", "coconut cream", "coconut butter", "almond milk", "oat milk", "soy milk", "soya milk", "rice milk", "cashew milk", "peanut butter", "almond butter", "cashew butter", "sunflower butter", "cocoa butter", "shea butter", "apple butter", "cream of tartar", "coconut yogurt", "butter lettuce"],
		},
		{
			name: "Meat & Poultry",
			keywords: ["chicken", "beef", "pork", "lamb", "turkey", "bacon", "sausage", "mince", "steak", "duck", "veal", "ham", "pancetta", "chorizo", "salami", "pepperoni", "brisket", "venison", "lard", "prosciutto", "gelatin", "gelatine"],
			excludeKeywords: ["chicken stock substitute", "vegan sausage", "vegetarian sausage", "beef substitute"],
		},
		{
			name: "Fish",
			keywords: ["salmon", "tuna", "cod", "fish", "anchovy", "sardine", "halibut", "tilapia", "sea bass", "haddock", "mackerel", "trout", "pollock", "snapper", "swordfish"],
		},
		{
			// A distinct allergen from finfish — someone reacting to shrimp can eat salmon
			name: "Shellfish",
			keywords: ["shrimp", "prawn", "crab", "lobster", "scallop", "squid", "calamari", "clam", "mussel", "oyster", "crayfish", "langoustine", "oyster sauce"],
		},
		{
			name: "Eggs",
			keywords: ["egg", "egg white", "egg yolk", "mayonnaise", "meringue"],
			excludeKeywords: ["egg substitute", "egg replacer", "flax egg"],
		},
		{
			name: "Tree Nuts",
			keywords: ["almond", "walnut", "pecan", "pine nut", "cashew", "pistachio", "hazelnut", "macadamia", "brazil nut", "chestnut", "praline", "marzipan", "nutella", "almond flour", "almond extract"],
		},
		{
			// Legumes, and a separate allergen from tree nuts
			name: "Peanuts",
			keywords: ["peanut", "peanut butter", "peanut oil", "groundnut", "satay"],
		},
		{
			name: "Soy",
			keywords: ["soy", "soya", "soy sauce", "tofu", "tempeh", "edamame", "miso", "tamari", "hoisin"],
		},
		{
			name: "Sesame",
			keywords: ["sesame", "tahini", "sesame oil", "sesame seed", "halva", "za'atar"],
		},
		{
			name: "Gluten",
			keywords: ["flour", "wheat", "bread", "pasta", "noodle", "barley", "rye", "couscous", "breadcrumb", "panko", "semolina", "spelt", "bulgur", "farro", "orzo", "cracker", "pastry", "seitan", "soy sauce", "beer", "malt"],
			excludeKeywords: ["gluten-free", "gluten free", "rice noodle", "glass noodle", "almond flour", "coconut flour", "chickpea flour", "corn flour", "cornflour", "rice flour", "buckwheat", "tamari", "rice cracker", "corn pasta"],
		},
	],

	// Grocery aisles, in the order a default shop is walked. Frozen sits near the
	// end so it spends the least time out of the freezer.
	shoppingCategories: [
		{
			name: "Produce",
			keywords: [
				"carrot", "onion", "garlic", "tomato", "lettuce", "spinach", "potato",
				"pepper", "cucumber", "celery", "mushroom", "broccoli", "cauliflower",
				"cabbage", "leek", "herb", "basil", "parsley", "cilantro", "coriander",
				"thyme", "rosemary", "sage", "mint", "chive", "lemon", "lime", "apple",
				"banana", "berry", "berries", "blueberry", "blueberries", "raspberry",
				"raspberries", "blackberry", "blackberries", "cranberry", "cranberries",
				"strawberry", "orange", "zucchini", "courgette", "squash", "avocado",
				"mango", "peach", "pear", "grape", "asparagus", "corn", "sweetcorn",
				"pea", "green bean", "beetroot", "beet", "ginger", "scallion",
				"spring onion", "kale", "arugula", "rocket", "fennel", "shallot",
				"radish", "artichoke", "eggplant", "aubergine", "sweet potato",
				"bok choy", "watercress", "endive", "lemongrass", "chilli pepper",
			],
		},
		{
			name: "Bakery",
			keywords: [
				"bread", "loaf", "baguette", "croissant", "roll", "bun", "sourdough",
				"brioche", "ciabatta", "focaccia", "bagel", "muffin", "scone",
				"tortilla", "wrap", "pitta", "pita", "naan", "flatbread", "crumpet",
				"english muffin", "pretzel", "breadstick", "cracker", "cake",
			],
		},
		{
			name: "Deli",
			keywords: [
				"prosciutto", "pancetta", "salami", "chorizo", "pepperoni", "ham",
				"olive", "hummus", "antipasti", "sliced meat", "cold cut",
				"charcuterie", "pate",
			],
		},
		{
			name: "Meat & Fish",
			keywords: [
				"chicken", "beef", "pork", "lamb", "turkey", "bacon", "sausage",
				"mince", "steak", "salmon", "tuna", "cod", "shrimp", "prawn", "fish",
				"duck", "veal", "anchovy", "sardine", "crab", "lobster", "scallop",
				"squid", "venison", "brisket", "ribs", "fillet", "halibut", "tilapia",
				"sea bass", "haddock", "mackerel", "trout", "clam", "mussel", "oyster",
			],
		},
		{
			name: "Dairy & Eggs",
			keywords: [
				"milk", "cheese", "butter", "cream", "yogurt", "yoghurt", "egg",
				"cheddar", "mozzarella", "parmesan", "gruyere", "gruyère", "brie",
				"sour cream", "crème fraîche", "creme fraiche", "cream cheese",
				"ricotta", "feta", "gouda", "goat cheese", "half and half", "ghee",
				"whipping cream", "double cream", "single cream", "mascarpone",
				"cottage cheese", "pecorino", "halloumi", "provolone", "buttermilk",
			],
		},
		{
			name: "Pantry",
			keywords: [
				"pasta", "rice", "noodle", "stock", "broth", "lentil", "chickpea",
				"black bean", "kidney bean", "cannellini", "butter bean", "oat",
				"quinoa", "couscous", "barley", "bulgur", "farro", "rotini", "penne",
				"fusilli", "rigatoni", "spaghetti", "macaroni", "orzo", "linguine",
				"farfalle", "gnocchi", "jasmine rice", "basmati rice", "arborio",
				"tomato paste", "chopped tomatoes", "passata", "coconut milk",
				"cereal", "granola", "raisin", "dried fruit", "crouton", "cornflake",
			],
		},
		{
			name: "Baking & Spices",
			keywords: [
				"flour", "sugar", "salt", "baking powder", "baking soda",
				"bicarbonate", "yeast", "cocoa", "chocolate", "vanilla", "cornstarch",
				"cornflour", "breadcrumb", "panko", "semolina", "honey", "maple syrup",
				"golden syrup", "molasses", "almond", "walnut", "pecan", "pine nut",
				"cashew", "pistachio", "hazelnut", "cumin", "paprika", "turmeric",
				"cinnamon", "nutmeg", "oregano", "cardamom", "bay leaf", "chili powder",
				"chilli powder", "curry powder", "garam masala", "black pepper",
				"peppercorn", "white pepper", "red pepper flakes", "chili flakes",
				"chilli flakes", "cayenne", "saffron", "star anise", "cloves",
				"allspice", "food colouring", "icing sugar", "powdered sugar",
				"brown sugar", "caster sugar",
			],
		},
		{
			name: "Condiments & Sauces",
			keywords: [
				"oil", "olive oil", "vegetable oil", "sesame oil", "sunflower oil",
				"coconut oil", "vinegar", "balsamic", "sauce", "soy sauce",
				"fish sauce", "hot sauce", "worcestershire", "hoisin", "sriracha",
				"mustard", "ketchup", "mayo", "mayonnaise", "tahini", "miso", "jam",
				"marmalade", "peanut butter", "pesto", "salsa", "relish", "chutney",
				"harissa", "gochujang", "teriyaki", "barbecue sauce",
			],
		},
		{
			name: "Drinks",
			keywords: [
				"wine", "beer", "cider", "coffee", "tea", "soda", "cola",
				"lemonade", "sparkling water", "tonic", "vodka", "rum", "whisky",
				"whiskey", "brandy", "sherry", "vermouth", "mirin", "sake",
				"orange juice", "apple juice", "cranberry juice", "fruit juice",
			],
		},
		{
			name: "Frozen",
			keywords: [
				"frozen", "ice cream", "sorbet", "gelato", "frozen peas",
				"frozen corn", "frozen spinach", "frozen berries", "frozen fish",
				"frozen chicken", "edamame", "puff pastry", "shortcrust pastry",
				"filo pastry", "frozen chips", "french fries", "ice",
			],
		},
		{
			// Non-food items added by hand to the list — the "toothpaste" case
			name: "Household & Other",
			keywords: [
				"toothpaste", "toilet paper", "kitchen roll", "paper towel", "detergent",
				"washing up liquid", "dish soap", "soap", "shampoo", "cling film",
				"foil", "aluminium foil", "bin bag", "trash bag", "sponge", "batteries",
				"napkin", "parchment paper", "baking paper", "ziploc", "deodorant",
				"razor", "tissue",
			],
		},
	],

	// One route by default, matching the category order above. Add a layout per
	// shop and reorder it by dragging categories in the shopping list view.
	storeLayouts: [
		{
			name: "Default",
			aisleOrder: [
				"Produce",
				"Bakery",
				"Deli",
				"Meat & Fish",
				"Dairy & Eggs",
				"Pantry",
				"Baking & Spices",
				"Condiments & Sauces",
				"Drinks",
				"Frozen",
				"Household & Other",
			],
		},
	],
	activeStoreLayout: "Default",
};
