
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
setTimeout(loadHome, 500);
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

function fetchNews(country, source='') {
    const newsContainer = document.getElementById("news-container");
    const loader = document.getElementById("loader")
    const paginationTop = document.getElementById("pagination-top");
    const paginationBottom = document.getElementById("pagination-bottom");

    newsContainer.textContent = "";
    paginationTop.innerHTML = "";
    paginationBottom.innerHTML = "";

    // Display loader while fetching data
    document.getElementById("loader").style.display = "block";

    let url = `https://newsapi.org/v2/top-headlines?country=${country}&apiKey=${apiKey}`;

    if (source){
        url = `https://newsapi.org/v2/top-headlines?sources=${source}&apiKey=${apiKey}`;
    }

    fetch(url)
        .then(response => response.json())
        .then(data => {
            newsContainer.textContent = "";
            loader.style.display = "none";
            if (data.status === "ok") {
                allArticles = data.articles;
                currentPage = 1;
                if (allArticles.length > 0) {
                    displayArticles();
                    createPagination();
                    console.log(data)
                  } else {
                    newsContainer.textContent = "No news available for this country.";
                  }
            } else {
                newsContainer.textContent = "Error fetching news.";
            }
        })
        .catch(error => {
            console.error("Error fetching news:", error);
            loader.style.display = "none";
            newsContainer.textContent = "Error fetching news.";
        });
}

function displayArticles() {
    const newsContainer = document.getElementById("news-container");
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

document.getElementById('showRegisterForm').addEventListener('click', () => {
    document.getElementById('modal').style.display = 'flex';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('loginForm').style.display = 'none';
});

document.getElementById('showLoginForm').addEventListener('click', () => {
    document.getElementById('modal').style.display = 'flex';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
});

window.onclick = function (event) {
    const modal = document.getElementById('modal');

    if (event.target == modal){
        modal.style.display = 'none';
    }
};

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('registerName').value;
    const username = document.getElementById('registerUsername').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;

    try {
        const response = await fetch('http://localhost:5000/register', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, username, email, password }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();

        if (result.success) {
            alert('Registration successful');
            document.getElementById('modal').style.display = 'none'; // Hide the modal
            document.getElementById('showLoginForm').click(); // Show the login form
        } else {
            alert('Registration failed: ' + result.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('There was an error during registration');
    }
});


// Function to handle login
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('http://localhost:5000/login', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json(); // Parse the response body as JSON
        const accessToken = result.accessToken; // Assuming accessToken is in the response JSON
        // localStorage.setItem('accessToken', accessToken);
        // localStorage.setItem('refreshToken', result.refreshToken); 
        // // localStorage.setItem('accessToken', accessToken);
        console.log('Access Token:', result.accessToken); 
        if (result.success) {
            alert('Login successful');
            document.getElementById('modal').style.display = 'none'; // Hide the modal
            document.getElementById('showLoginForm').style.display = 'none'; // Hide login button
            document.getElementById('showRegisterForm').style.display = 'none'; // Hide register button
            document.getElementById('logoutButton').style.display = 'block'; // Show logout button
            localStorage.setItem('accessToken', result.accessToken);
            localStorage.setItem('refreshToken', result.refreshToken);
            localStorage.setItem('loggedIn', 'true'); // Save login state in local storage
            checkLoginState(); // Update the state based on login
        } else {
            alert('Login failed: ' + result.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('There was an error during login');
    }
});

function checkLoginState() {
    if (localStorage.getItem('loggedIn') === 'true') {
        document.getElementById('showLoginForm').style.display = 'none';
        document.getElementById('showRegisterForm').style.display = 'none';
        document.getElementById('logoutButton').style.display = 'block';
        
    } else {
        document.getElementById('showLoginForm').style.display = 'block';
        document.getElementById('showRegisterForm').style.display = 'block';
        document.getElementById('logoutButton').style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkLoginState();
});


document.getElementById('logoutButton').addEventListener('click', async () => {
    try {
        const response = await fetch('http://localhost:5000/signout', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error('Network response was not ok');
        }

        const result = await response.json();
        if (result.success) {
            alert('Logout Successful');
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('loggedIn');
            checkLoginState();
        } else {
            alert('Logout Failed: ' + result.message);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('There was an error during logout');
    }
});
