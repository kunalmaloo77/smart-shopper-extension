async function fetchSimilarProducts(query) {
  try {
    const response = await fetch(
      `https://real-time-product-search.p.rapidapi.com/search-v2?q=${encodeURIComponent(
        query
      )}&country=in&language=en&sort_by=BEST_MATCH&product_condition=ANY&return_filters=true`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-host": "real-time-product-search.p.rapidapi.com",
          "x-rapidapi-key":
            "0ce8c0d1a0msh41992f71b576788p190e76jsn75a91d403d47",
        },
      }
    );

    if (!response.ok) throw new Error("API request failed");
    const data = await response.json();
    return data;
  } catch (err) {
    return { error: err.message };
  }
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, "getProduct", async (response) => {
    const resultDiv = document.getElementById("result");

    if (chrome.runtime.lastError) {
      resultDiv.innerText = "Error: " + chrome.runtime.lastError.message;
      return;
    }

    if (!response?.title) {
      resultDiv.innerText = "No product found";
      return;
    }

    const currentPrice = response.price
      ? parseFloat(response.price.replace(/[^0-9.]/g, ""))
      : Infinity;

    resultDiv.innerHTML = `<p class="searching">Searching for similar products...</p>`;

    // Check cache
    const cacheKey = `similar_products_${response.title}`;
    const cachedData = await new Promise((resolve) => {
      chrome.storage.local.get(cacheKey, (result) => resolve(result[cacheKey]));
    });

    let data;
    if (cachedData) {
      data = cachedData;
    } else {
      data = await fetchSimilarProducts(response.title);
      if (!data.error) {
        chrome.storage.local.set({ [cacheKey]: data });
      }
    }

    if (data.error) {
      resultDiv.innerHTML = `<p class="error">Error: ${data.error}</p>`;
      return;
    }

    if (data.data?.products && data.data.products.length > 0) {
      const lowerPricedProducts = data.data.products.filter((item) => {
        const itemPrice = item.offer.price
          ? parseFloat(item.offer.price.replace(/[^0-9.]/g, ""))
          : Infinity;
        return itemPrice < currentPrice;
      });

      if (lowerPricedProducts.length > 0) {
        resultDiv.innerHTML =
          "<h2>Cheaper Alternatives</h2><ul class='product-list'>";
        lowerPricedProducts.forEach((item) => {
          const photo =
            item.product_photos && item.product_photos.length > 0
              ? item.product_photos[0]
              : "";
          resultDiv.innerHTML += `
            <li class="product-item">
              <img src="${photo}" alt="${
            item.product_title
          }" class="product-image">
              <a href="${
                item.offer.offer_page_url
              }" target="_blank" class="product-title">${item.product_title}</a>
              <p class="product-price">Price: ${item.offer.price || "N/A"}</p>
            </li>`;
        });
        resultDiv.innerHTML += "</ul>";
      } else {
        resultDiv.innerHTML =
          "<p class='no-results'>No cheaper alternatives found.</p>";
      }
    } else {
      resultDiv.innerHTML =
        "<p class='no-results'>No similar products found.</p>";
    }
  });
});
