// --- DOM elements ---
const randomBtn = document.getElementById("random-btn");
const recipeDisplay = document.getElementById("recipe-display");

// This function creates a list of ingredients for the recipe from the API data
// It loops through the ingredients and measures, up to 20, and returns an HTML string
// that can be used to display them in a list format
// If an ingredient is empty or just whitespace, it skips that item 
function getIngredientsHtml(recipe) {
  let html = "";
  for (let i = 1; i <= 20; i++) {
    const ing = recipe[`strIngredient${i}`];
    const meas = recipe[`strMeasure${i}`];
    if (ing && ing.trim()) html += `<li>${meas ? `${meas} ` : ""}${ing}</li>`;
  }
  return html;
}

// Get DOM elements for saved recipes
const savedRecipesContainer = document.getElementById("saved-recipes-container");
const savedRecipesList = document.getElementById("saved-recipes-list");

// Helper function to get saved recipe names from localStorage
function getSavedRecipeNames() {
  const saved = localStorage.getItem("savedRecipeNames");
  return saved ? JSON.parse(saved) : [];
}

// Helper function to save recipe names to localStorage
function setSavedRecipeNames(names) {
  localStorage.setItem("savedRecipeNames", JSON.stringify(names));
}

// Render the saved recipes list above the main recipe display
function renderSavedRecipesList() {
  const names = getSavedRecipeNames();
  if (names.length === 0) {
    savedRecipesContainer.style.display = "none";
    savedRecipesList.innerHTML = "";
    return;
  }
  savedRecipesContainer.style.display = "block";
  savedRecipesList.innerHTML = names.map((name, idx) =>
    `<li class="saved-recipe-item">
      <span class="saved-recipe-name" data-name="${name}">${name}</span>
      <button class="delete-btn" data-index="${idx}">Delete</button>
    </li>`
  ).join("");

  // Add event listeners for delete buttons
  const deleteBtns = savedRecipesList.querySelectorAll(".delete-btn");
  deleteBtns.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const index = parseInt(btn.getAttribute("data-index"));
      const updatedNames = getSavedRecipeNames();
      updatedNames.splice(index, 1); // Remove the recipe at this index
      setSavedRecipeNames(updatedNames);
      renderSavedRecipesList();
    });
  });

  // Add event listeners for recipe name clicks
  const nameSpans = savedRecipesList.querySelectorAll(".saved-recipe-name");
  nameSpans.forEach(span => {
    span.addEventListener("click", async () => {
      const recipeName = span.getAttribute("data-name");
      recipeDisplay.innerHTML = "<p>Loading recipe...</p>";
      try {
        // Fetch recipe details by name from MealDB
        const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(recipeName)}`);
        const data = await res.json();
        const recipe = data.meals && data.meals[0];
        if (recipe) {
          window.currentRecipe = recipe; // Update current recipe for remixing
          renderRecipe(recipe);
          remixOutput.innerHTML = ""; // Clear previous remix
        } else {
          recipeDisplay.innerHTML = "<p>Sorry, couldn't find that recipe.</p>";
        }
      } catch (error) {
        recipeDisplay.innerHTML = "<p>Sorry, couldn't load that recipe.</p>";
      }
    });
  });
}

// This function displays the recipe on the page
function renderRecipe(recipe) {
  recipeDisplay.innerHTML = `
    <div class="recipe-title-row">
      <h2>${recipe.strMeal}</h2>
    </div>
    <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" />
    <h3>Ingredients:</h3>
    <ul>${getIngredientsHtml(recipe)}</ul>
    <h3>Instructions:</h3>
    <p>${recipe.strInstructions.replace(/\r?\n/g, "<br>")}</p>
    <button id="save-recipe-btn" class="save-inline-btn">Save Recipe</button>
  `;
  // Add event listener for Save Recipe button
  const saveBtn = document.getElementById("save-recipe-btn");
  saveBtn.addEventListener("click", () => {
    const names = getSavedRecipeNames();
    if (!names.includes(recipe.strMeal)) {
      names.push(recipe.strMeal);
      setSavedRecipeNames(names);
      renderSavedRecipesList();
    }
  });
}

// This function gets a random recipe from the API and shows it
async function fetchAndDisplayRandomRecipe() {
  recipeDisplay.innerHTML = "<p>Loading...</p>"; // Show loading message
  try {
    // Fetch a random recipe from the MealDB API
    const res = await fetch('https://www.themealdb.com/api/json/v1/1/random.php'); 
    const data = await res.json(); // Parse the JSON response
    const recipe = data.meals[0]; // Get the first recipe from the response

    window.currentRecipe = recipe; // Save for remixing

    renderRecipe(recipe); // Render the recipe on the page

    remixOutput.innerHTML = ""; // Clear previous remix

  } catch (error) {
    recipeDisplay.innerHTML = "<p>Sorry, couldn't load a recipe.</p>";
    remixOutput.innerHTML = "";
  }
}


// --- Remix feature ---

// Get DOM elements for remix controls
const remixBtn = document.getElementById("remix-btn");
const remixThemeSelect = document.getElementById("remix-theme");
const remixOutput = document.getElementById("remix-output");

// This function sends the recipe and remix theme to OpenAI and displays the remix
async function remixRecipeWithAI(recipe, theme) {
  // Show a fun and friendly loading message while waiting for the AI
  remixOutput.innerHTML = "<p>🪄 Chef is remixing your recipe... Get ready for a tasty twist!</p>";

  // Build the prompt for the AI
  const prompt = `
You are a creative chef. Remix the following recipe with this theme: "${theme}".
Give a short, fun, and doable version. Highlight any changed ingredients or instructions.
Recipe JSON:
${JSON.stringify(recipe, null, 2)}
`;

  try {
    // Send the prompt to OpenAI's chat completions API
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}` // API key from secrets.js
      },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: "You are a creative chef remixing recipes for beginners." },
          { role: "user", content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.8
      })
    });

    const data = await res.json(); // Parse the JSON response

    // Get the AI's reply text
    const aiReply = data.choices && data.choices[0] && data.choices[0].message.content
      ? data.choices[0].message.content
      : null;

    // Display the remix on the page, or a friendly error if missing
    remixOutput.innerHTML = aiReply
      ? aiReply
      : "<p>Oops! Chef couldn't remix your recipe this time. Please try again in a moment.</p>";

  } catch (error) {
    remixOutput.innerHTML = "<p>Oops! Something went wrong while remixing. Please check your internet connection and try again.</p>";
  }
}

// When the remix button is clicked, send the current recipe and theme to OpenAI
remixBtn.addEventListener("click", () => {
  // Get the currently displayed recipe from the page
  // We need to store the last fetched recipe for remixing
  if (window.currentRecipe) {
    const theme = remixThemeSelect.value;
    remixRecipeWithAI(window.currentRecipe, theme);
  } else {
    remixOutput.innerHTML = "<p>No recipe to remix yet!</p>";
  }
});

// When the button is clicked, get and show a new random recipe
randomBtn.addEventListener("click", fetchAndDisplayRandomRecipe);

// When the page loads, show a random recipe right away and load saved recipes
window.addEventListener('DOMContentLoaded', () => {
  fetchAndDisplayRandomRecipe();
  renderSavedRecipesList();
});