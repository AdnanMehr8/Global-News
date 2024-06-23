
const apiKey = '02f0bf7915d14e66b143dd95ae0be96b';
let currentCountry = '';
let currentPage = 1;
const articlesPerPage = 6;
let allArticles = [];

function scrollToFooter() {
    const footer = document.getElementById("footer");
    footer.scrollIntoView({ behavior: "smooth" });
}

// Load CNN news when the page loads
document.addEventListener('DOMContentLoaded', () => {
    loadHome();
});

function loadHome() {
   
    const countryDisable = document.getElementById("text")

    countryDisable.style.display = "none"; // dont show the text in home page

    fetchNews('us', 'bbc-news');
}


function updateCountryName() {
    const countryInput = document.getElementById("country");
    const countryDisplay = document.getElementById("demo");
    const countryDisable = document.getElementById("text")
    countryDisplay.classList.remove("fade-in");

    countryDisplay.offsetWidth; // trigger reflow
    countryDisplay.classList.add("fade-in");
    currentCountry = countryInput.value;
    countryDisplay.textContent = currentCountry;
    countryDisplay.textContent = `Here's what happened in ${currentCountry}:`;

    countryDisable.style.display = "block"; 

    fetchNews(currentCountry);
}


// Function to fetch news
function fetchNews(country, category = '') {
    const newsContainer = document.getElementById("news-container-entertainment");
    newsContainer.innerHTML = ""; // Clear previous content

     // Set the text content of the <h2> element based on the category
     const pageTitle = category.charAt(0).toUpperCase() + category.slice(1);
     document.getElementById("ctg-name").textContent = `${pageTitle} News`;

    // Display loader while fetching data
    document.getElementById("loader").style.display = "block";

    let url = `https://newsapi.org/v2/top-headlines?country=${country}&apiKey=${apiKey}`;

    // If category is specified, append it to the URL
    if (category) {
        url += `&category=${category}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            // Hide loader after data is fetched
            document.getElementById("loader").style.display = "none";

            if (data.status === "ok") {
                allArticles = data.articles
                // const articles = data.articles;
                if (allArticles.length > 0) {
                    console.log(data);
                    displayArticles();
                    createPagination();
                } else {
                    newsContainer.textContent = "No news available for this category.";
                }
            } else {
                newsContainer.textContent = "Error fetching news.";
            }
        })
        .catch(error => {
            console.error("Error fetching news:", error);
            newsContainer.textContent = "Error fetching news.";
        });
}

setTimeout(loadEntertainment, 500);

function loadEntertainment () {
    fetchNews('us', 'entertainment');
}

// Load entertainment news when the page loads
document.addEventListener('DOMContentLoaded', () => {
    loadEntertainment();
});


function displayArticles() {
    const newsContainer = document.getElementById("news-container-entertainment");
    newsContainer.innerHTML = "";

    const startIndex = (currentPage - 1) * articlesPerPage;
    const endIndex = startIndex + articlesPerPage;
    const articlesToDisplay = allArticles.slice(startIndex, endIndex);

    articlesToDisplay.forEach(article => {
        const newsItem = document.createElement("div");
        newsItem.classList.add("news-item");
        
        const defaultImagePath = 'logo.PNG';
        let imageUrl = article.urlToImage || defaultImagePath;
        newsItem.innerHTML = `
            <h3><a href="${article.url}" target="_blank">${article.title}</a></h3>
            <img src="${imageUrl}" alt="${article.title}">
            <p>${article.description}</p>
        `;

        newsContainer.appendChild(newsItem);
    });
}

function createPagination() {
    const paginationTop = document.getElementById("pagination-top");
    const paginationBottom = document.getElementById("pagination-bottom");
  
    paginationTop.innerHTML = "";
    paginationBottom.innerHTML = "";

    const totalPages = Math.ceil(allArticles.length / articlesPerPage);

    for (let i = 1; i <= totalPages; i++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = i;
        pageButton.classList.add("pagination-button");
        if (i === currentPage) {
            pageButton.classList.add("active");
        }
        pageButton.addEventListener("click", () => {
            currentPage = i;
            displayArticles();
            createPagination();
        });

        paginationTop.appendChild(pageButton);
        paginationBottom.appendChild(pageButton.cloneNode(true));
    }
}

