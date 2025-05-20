import re
import webbrowser
import requests
import requests_cache
from bs4 import BeautifulSoup
import json
import urllib.parse
import urllib

def clean_quotes(text):
    # Replace all double and single quotes with empty string
    return re.sub(r'[\'"]', '', text)

# Crawlbase API key
CRAWLBASE_API_KEY = "KpoG7F690McIB1OY2pMnUw"
crawl_base="https://api.crawlbase.com/?token="
def apiFetch(url):
   headers = {
       "Authorization": f"Bearer {CRAWLBASE_API_KEY}",
       "Content-Type": "application/json",
       "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115 Safari/537.36",
   }
   session = requests_cache.install_cache("http_cache",expire_after = 86400)
   api_request = f'{crawl_base}{CRAWLBASE_API_KEY}&url={url}'
   response = requests.get(api_request, headers=headers)
   soup = BeautifulSoup(response.content, "html.parser")
#    print(soup)
   return soup

def crawlbase_extract(url):
    try:
        soup = apiFetch(url)
        features_dict=dict()
        script_tag = soup.find('script', {'id': '__NEXT_DATA__'})
        if script_tag:
           # Extract the content of the script tag (the JSON data)
           json_data = script_tag.string
           # Parse the JSON content
           data = json.loads(json_data)
           features_dict['url']=url
           for i in data['props']['pageProps']['initialData']['data']['idml']['specifications']:
             features_dict[i['name']]=i['value']
           for j in data['props']['pageProps']['initialData']['data']['idml']['productHighlights']:
               features_dict[j['name']]=j['value']
           features_dict['product_title']=data['props']['pageProps']['initialData']['data']['product']['name']   

        # print("features_dict",features_dict)

        meta_tag = soup.find('meta', {'property': 'og:image'})

        if meta_tag:
                image_link = meta_tag['content']
                features_dict['image_urls']=[image_link]


        # Extract the title, brand, model, price, and image URL

        # title = features_dict.get('product_title', 'N/A')
        title = features_dict['product_title'] if 'product_title' in features_dict else 'N/A'
        # brand = features_dict.get('Brand', 'N/A')
        brand = features_dict['Brand'] if 'Brand' in features_dict else 'N/A'
        # model_tag = features_dict.get('Model', 'N/A')
        model = features_dict['Model'] if 'Model' in features_dict else (features_dict['Model Name'] if 'Model Name' in features_dict else 'N/A')
        # model = (
        #     features_dict.get('Model', 'N/A')
        #     or features_dict.get('Model Name', 'N/A')
        #     or 'N/A'
        # )
        # manufacturer = features_dict.get('Manufacturer Part Number', 'N/A')
        manufacturer = features_dict['Manufacturer Part Number'] if 'Manufacturer Part Number' in features_dict else 'N/A'
        # price = features_dict.get('Price', 'N/A')
        price = features_dict['Price'] if 'Price' in features_dict else 'N/A'
        # isbn13 = features_dict.get('ISBN-13', 'N/A')
        isbn13 = features_dict['ISBN-13'] if 'ISBN-13' in features_dict else 'N/A'
        # isbn10 = features_dict.get('ISBN-10', 'N/A')
        isbn10 = features_dict['ISBN-10'] if 'ISBN-10' in features_dict else 'N/A'
        # ean= features_dict.get('EAN', 'N/A')
        ean = features_dict['EAN'] if 'EAN' in features_dict else 'N/A'
        # print(f"EAN from features_dict: {ean}")
        if ean == 'N/A':
            ean_found = False
            ul_tags = soup.find_all('ul')
            for ul in ul_tags:
                li_tags = ul.find_all('li')
                for li in li_tags:
                    if 'EAN:' in li.text:
                        print(f"Found EAN in <ul><li>: {li.text}")
                        ean = li.text.split('EAN:')[-1].strip()
                        print(f"EAN found in <ul><li>: {ean}")
                        ean_found = True
                        break
                if ean_found:
                    break
            if not ean_found:
                ean = 'N/A'
        else:
            print(f"EAN from features_dict: {ean}")

        ld_json_script = soup.find('script', {
            'type': 'application/ld+json',
            'data-seo-id': 'schema-org-product'
        })

        gtin13 = None  
        if ld_json_script:
            try:
                ld_data = json.loads(ld_json_script.string)
                gtin13 = ld_data['gtin13'] if 'gtin13' in ld_data else "N/A"
                print("gtin13",gtin13)
                if gtin13 == "N/A":
                    for item in ld_data:
                        # print("item:",item)
                        has_variant=item['hasVariant'] 
                        if has_variant:
                            print("yes_has_present")
                            for variant in has_variant:
                                if 'gtin13' in variant:
                                    gtin13 = variant['gtin13']
                                    break
                # Fallback if gtin13 is not found
                if gtin13 is None:
                    gtin13 = "N/A"
                print("gtin13",gtin13)
            except json.JSONDecodeError:
                print("JSON decode error while extracting gtin13 from ld+json")


        image_url = features_dict['image_urls'][0] if 'image_urls' in features_dict else 'N/A'
        # print(f"Title: {title}, Brand: {brand}, Model: {model}, Price: {price}, Image URL: {image_url}, Manufacturer: {manufacturer}, ISBN-13: {isbn13}, ISBN-10: {isbn10}", f" EAN: {ean}", f" GTIN-13: {gtin13}")
        return clean_quotes(title), clean_quotes(brand), clean_quotes(model),clean_quotes(manufacturer), clean_quotes(price), clean_quotes(isbn13),clean_quotes(isbn10),clean_quotes(ean),clean_quotes(image_url), clean_quotes(gtin13)
    except Exception as e:
        print(f"Error extracting Walmart page: {e}")
        return "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A"

def crawlbase_search(query):
    print(f"Searching on Google via Crawlbase: {query}")
    query1 = query.replace(" ", "+")
    google_search_url = f"https://www.google.com/search?q={query1}"
    # webbrowser.open_new(google_search_url)
    # print(f"Google search URL: {google_search_url}")
    api_url = f"https://api.crawlbase.com/?token={CRAWLBASE_API_KEY}&url={google_search_url}&page_wait=5000&format=json"

    query2 = query.replace(' ', '+')
    amazon_search_url = f"https://www.amazon.com/s?k={query2}"
    # webbrowser.open_new_tab(amazon_search_url)
    # webbrowser.open_new_tab(ebay_search_url)
    query3 = query.replace(' ', '+')
    ebay_search_url = f"https://www.ebay.com/sch/i.html?_nkw={query3}"  
    # print(f"eBay search URL: {ebay_search_url}")
    query4 = query.replace(' ', '+')
    target_search_url = f"https://www.target.com/s?searchTerm={query4}"
    # print(f"Target search URL: {target_search_url}")
    query5 = query.replace(' ', '+')
    bestbuy_search_url = f"https://www.bestbuy.com/site/searchpage.jsp?st={query5}"
    # print(f"Opening Bestbuy search for: {query5}")
    # print(f"Bestbuy search URL: {bestbuy_search_url}")

    #query  for wayfair.com
    query6 = query.replace(' ', '+')
    wayfair_search_url = f"https://www.wayfair.com/keyword.php?keyword={query6}"
    # print(f"Opening Wayfair search for: {query6}")
    # print(f"Wayfair search URL: {wayfair_search_url}")
    return amazon_search_url, google_search_url, ebay_search_url, target_search_url, bestbuy_search_url, wayfair_search_url

def process_walmart_links(urls):
    results = []
    for url in urls:
        try:
            title, brand, model,manufacturer, price,isbn13,isbn10,ean, image_url,gtin13 = crawlbase_extract(url)
            results.append({
                "walmart_url": url,
                "title": title,
                "brand": brand,
                "model": model,
                "manufacturer": manufacturer,
                "ean":ean,
                "isbn13": isbn13,
                "isbn10": isbn10,
                "price": price,
                "image_url": image_url,
                "gtin13": gtin13
            })
        except Exception as e:
            print(f"Error processing {url}: {e}")
            results.append({
                "walmart_url": url,
                "title": "Error",
                "brand": "Error",
                "model": "Error",
                "manufacturer": "Error",
                "ean": "Error",
                "isbn13": "Error",
                "isbn10": "Error",
                "price": "Error",
                "isbn": "Error",
                "image_url": "Error",
                "gtin13": "Error"
            })

    return results

def search_amazon_product(part1, part2, part3, search_type):
    part1 = part1.strip() if part1 else ""
    part2 = part2.strip() if part2 else ""
    part3 = part3.strip() if part3 else ""
    print(f"Part1: {part1}, Part2: {part2}, Part3: {part3} Search Type: {search_type}")
    if search_type == "title":
        query = part1
    elif search_type == "title_brand":
        query = f"{part1} %2B {part2}"
    elif search_type == "title_model":
        query = f"{part1} %2B {part2}"
    elif search_type == "brand_model":
        query = f"{part1} %2B {part2}"
    elif search_type == "title_brand_model":
        query = f"{part1} %2B {part2} %2B {part3}"
    else:
        query = part1

    query = query.strip()
    amazon_link, google_link, ebay_link, target_link, bestbuy_link, wayfair_link = crawlbase_search(query)
    return amazon_link, google_link, ebay_link, target_link, bestbuy_link, wayfair_link