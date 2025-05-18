from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi import Request
import gspread
import tempfile
from google.oauth2.service_account import Credentials
import openpyxl
import requests
from backend.crawler import crawlbase_extract, search_amazon_product
import shutil
import csv
import os
from datetime import datetime, timedelta

app = FastAPI()

app.mount("/static", StaticFiles(directory="frontend"), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    with open("frontend/index.html", "r") as f:
        return f.read()

@app.post("/search/")
async def search_amazon_endpoint(request: Request):
    data = await request.json()
    part1 = data.get("part1")
    part2 = data.get("part2")
    part3 = data.get("part3")
    search_type = data.get("search_type")
    
    amazon_url, google_url, ebay_url, target_url, bestbuy_url, wayfair_url = search_amazon_product(part1, part2, part3, search_type)

    return {
        "amazon_url": amazon_url, 
        "google_url": google_url,
        "ebay_url": ebay_url,
        "target_url": target_url,
        "bestbuy_url": bestbuy_url,
        "wayfair_url": wayfair_url
    }

@app.post("/process/")
async def process(
    url: str = Form(None),
    assignee: str = Form(None),
    taskSerial: str = Form(None),
    itemId: str = Form(None),
    category: str = Form(None)
):
    urls = [url.strip()]

    extracted_data = []
    for url in urls:
        try:
            title, brand, model,manufacturer, price,isbn13,isbn10,ean, image_url,gtin13 = crawlbase_extract(url)
            extracted_data.append({
                "walmart_url": url,
                "title": title,
                "brand": brand,
                "model": model,
                "price": price,
                "manufacturer": manufacturer,
                "ean": ean,
                "isbn13": isbn13,
                "isbn10": isbn10,
                "image_url": image_url,
                "gtin13": gtin13

            })
        except Exception as e:
            extracted_data.append({
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
    
    model_tag = None
    if model == 'N/A' and manufacturer == 'N/A':
        model_tag = 'N/A'
    elif model == manufacturer:
        model_tag = manufacturer
    elif model == 'N/A' and manufacturer != 'N/A':
        model_tag = manufacturer
    elif model != 'N/A' and manufacturer == 'N/A':
        model_tag = model_tag
    elif model != 'N/A' and manufacturer != 'N/A':
        model_tag = f"{model} %2B {manufacturer}"
    
    isbn_ean_bool = False
    isbn_ean=None
    if isbn13=="N/A" and ean == "N/A":
        isbn_ean="N/A"
    elif isbn13=="N/A" and ean != "N/A":
        isbn_ean=ean
        isbn_ean_bool = True
    elif isbn13 !="N/A" and ean == "N/A":
        isbn_ean=isbn13
        isbn_ean_bool = True
    elif isbn13 !="N/A" and ean != "N/A":
        isbn_ean = isbn13
        isbn_ean_bool = True
# isbn/ean
# upc/gtin13
    html_content = "<h2>Results:</h2>"
    for idx, res in enumerate(extracted_data):
        html_content += f"<div id='product_{idx}' style='border: 1px solid #ccc; padding: 10px; margin-bottom: 10px;'>"
        html_content += f"<p><b>Title:</b> {res['title']}</p>"
        html_content += f"<p><b>Brand:</b> {res['brand']}</p>"
        html_content += f"<p><b>Model:</b> {res['model']}</p>"
        html_content += f"<p><b>ISBN13:</b> {res['isbn13']}</p>"
        html_content += f"<p><b>ISBN10:</b> {res['isbn10']}</p>"
        html_content += f"<p><b>EAN:</b> {res['ean']}</p>"
        html_content += f"<p><b>UPC:</b> {res['gtin13']}</p>"
        # html_content += f"<p><b>Price:</b> {res['price']}</p>"
        html_content += f"<p><b>Image:</b> <a href='{res['image_url']}' target='_blank'>Link</a></p>"

        # Amazon search buttons
        # Amazon search buttons
        if isbn_ean_bool:
            html_content += f"""
            <button onclick="searchAmazon('{isbn_ean}', '', '', 'title', {idx})">Step 1.1: ISBN/EAN Search</button>
            <button onclick="searchAmazon('{gtin13}', '', '', 'title', {idx})">Step 1.2: UPC Search</button>"""
        else:
            html_content += f"""
            <button onclick="searchAmazon('{res['gtin13']}', '', '', 'title', {idx})">Step 1: UPC Search</button>"""
        html_content += f"""
        <button onclick="searchAmazon('{res['title']}', '', '', 'title', {idx})">Step 2: Title Search</button>
        <button onclick="searchAmazon('{res['title']}', '{res['brand']}', '', 'title_brand', {idx})">Step 3: Title + Brand Search</button>
        <button onclick="searchAmazon('{res['title']}', '{model_tag}', '', 'title_model', {idx})">Step 4: Title + Model </button>
        <button onclick="searchAmazon('{res['brand']}', '{model_tag}', '', 'brand_model', {idx})">Step 5: Brand + Model Search</button>
        <button onclick="searchAmazon('{res['title']}', '{res['brand']}', '', 'title_brand', {idx})">Step 6: Custom Title + Brand Search</button>
        <button onclick="searchAmazon('{res['title']}', '{model_tag}', '', 'title_model', {idx})">Step 7: Custom Title + Model </button>
        <button onclick="searchAmazon('{res['title']}', '', '', 'title', {idx})">Step 8: Custom Title Search</button>
        <button onclick="searchAmazon('{res['title']}', '{res['brand']}','{model_tag}', 'title_brand_model', {idx})">Step 9: Custom Title + Brand + Model Search</button>
        <button onclick="openGoogleLens('{res['image_url']}', {idx})">Step 10: Google Image Search</button>
        <br><br>
        <div id="amazon_link_{idx}"></div>
        <div id="google_link_{idx}"></div>
        <div id="ebay_link_{idx}"></div>
        <div id="target_link_{idx}"></div>
        <div id="bestbuy_link_{idx}"></div>
        <div id="wayfair_link_{idx}"></div>
        <div id="match_form_{idx}" style="display: none; margin-top: 12px;"></div>
        """
        # html_content += "</div><hr>"
        

    return HTMLResponse(content=html_content)

@app.get("/get-sheet-data/")
async def get_sheet_data():
    try:
        scope = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
        creds = Credentials.from_service_account_file("credentials.json", scopes=scope)
        client = gspread.authorize(creds)
        sheet = client.open_by_key("1Qg9iJGUAxSacy-SflMbcsM_nXkT79JcWdqEwGBRrnWY").sheet1
        all_values = sheet.get('A1:Z', value_render_option='FORMATTED_VALUE')
        
        headers = all_values[0]
        sl_no_index = None
        assignee_index = None
        item_id_index = None
        submit_index = None
        l2_assignee_index = None
        Comp_Url_index = None
        Match_Type_index = None
        Match_Type_Comments_index = None
        Notes_index = None
        Comments_index = None
        Start_TimeStamp_index = None
        End_TimeStamp_index = None
        AHT_Sec_index = None
        AHT_Min_index = None
        Search_Type_index = None
        Source_Of_Search_index = None
        Search_Keyword_index = None

        for idx, header in enumerate(headers):
            if header.strip() == "Sl. No":
                sl_no_index = idx
            elif header.strip() == "Assignee":
                assignee_index = idx
            elif header.strip() == "Item_Id":
                item_id_index = idx
            elif header.strip() == "Submit":
                submit_index = idx
            elif header.strip() == "Assignee L2":
                l2_assignee_index = idx
            elif header.strip() == "Comp_Url":
                Comp_Url_index = idx
            elif header.strip() == "Match_Type":
                Match_Type_index = idx
            elif header.strip() == "Match_Type_Comments":
                Match_Type_Comments_index = idx
            elif header.strip() == "Notes":
                Notes_index = idx
            elif header.strip() == "Comments":
                Comments_index = idx
            elif header.strip() == "Start TimeStamp":
                Start_TimeStamp_index = idx
            elif header.strip() == "End TimeStamp":
                End_TimeStamp_index = idx
            elif header.strip() == "AHT(in Seconds)":
                AHT_Sec_index = idx
            elif header.strip() == "AHT(In Min)":
                AHT_Min_index = idx
            elif header.strip() =="Search_Type":
                Search_Type_index = idx
            elif header.strip() == "Source_Of_Search":
                Source_Of_Search_index = idx
            elif header.strip() == "Search_Keyword":
                Search_Keyword_index = idx
        
        if sl_no_index is None or assignee_index is None or item_id_index is None:
            return {"error": "Required headers ('Sl. No', 'Assignee', 'Item ID') not found in sheet"}
        
        assignees = set()
        serial_numbers = set()
        item_ids = set()
        submit = set()
        l2_assignees = set()
        comp_urls = set()
        match_types = set()
        match_Type_Comments = set()
        notes = set()
        comments = set()
        Start_TimeStamps = set()
        End_TimeStamps = set()
        AHT_Mins = set()
        AHT_Secs = set()
        Search_Types = set()
        Source_Of_Searchs = set()
        Search_Keywords = set()

        rows = []
        
        for row in all_values[1:]:
            if len(row) > sl_no_index and row[sl_no_index]:
                serial_numbers.add(row[sl_no_index])
            if len(row) > assignee_index and row[assignee_index]:
                assignees.add(row[assignee_index])
            if len(row) > item_id_index and row[item_id_index]:
                item_ids.add(row[item_id_index])
            if len(row) > submit_index and row[submit_index]:
                submit.add(row[submit_index])
            if len(row) > l2_assignee_index and row[l2_assignee_index]:
                l2_assignees.add(row[l2_assignee_index])
            if len(row) > Comp_Url_index and row[Comp_Url_index]:
                comp_urls.add(row[Comp_Url_index])
            if len(row) > Match_Type_index and row[Match_Type_index]:
                match_types.add(row[Match_Type_index])
            if len(row) > Match_Type_Comments_index and row[Match_Type_Comments_index]:
                match_Type_Comments.add(row[Match_Type_Comments_index])
            if len(row) > Notes_index and row[Notes_index]:
                notes.add(row[Notes_index])
            if len(row) > Comments_index and row[Comments_index]:
                comments.add(row[Comments_index])
            if len(row) > Start_TimeStamp_index and row[Start_TimeStamp_index]:
                Start_TimeStamps.add(row[Start_TimeStamp_index])
            if len(row) > End_TimeStamp_index and row[End_TimeStamp_index]:
                End_TimeStamps.add(row[End_TimeStamp_index])
            if len(row) > AHT_Min_index and row[AHT_Min_index]:
                AHT_Mins.add(row[AHT_Min_index])
            if len(row) > AHT_Sec_index and row[AHT_Sec_index]:
                AHT_Secs.add(row[AHT_Sec_index])
            if len(row) > Search_Type_index and row[Search_Type_index]:
                Search_Types.add(row[Search_Type_index])
            if len(row) > Source_Of_Search_index and row[Source_Of_Search_index]:
                Source_Of_Searchs.add(row[Source_Of_Search_index])
            if len(row) > Search_Keyword_index and row[Search_Keyword_index]:
                Search_Keywords.add(row[Search_Keyword_index])
            rows.append(row)
        
        assignees = sorted(assignees)
        serial_numbers = sorted(serial_numbers)
        item_ids = sorted(item_ids)
        l2_assignees = sorted(l2_assignees)
        submit = sorted(submit)
        comp_urls = sorted(comp_urls)
        match_types = sorted(match_types)
        match_Type_Comments = sorted(match_Type_Comments)
        notes = sorted(notes)
        comments = sorted(comments)
        Start_TimeStamps = sorted(Start_TimeStamps)
        End_TimeStamps = sorted(End_TimeStamps)
        AHT_Mins = sorted(AHT_Mins)
        AHT_Secs = sorted(AHT_Secs)
        Search_Types = sorted(Search_Types)
        Source_Of_Searchs = sorted(Source_Of_Searchs)
        Search_Keywords = sorted(Search_Keywords)
        return {
            "assignees": assignees,
            "serial_numbers": serial_numbers,
            "item_ids": item_ids,
            "submit": submit,
            "rows": rows,
            "headers": headers,
            "l2_assignees": l2_assignees,
            "comp_urls": comp_urls,
            "match_types": match_types,
            "match_Type_Comments": match_Type_Comments,
            "notes": notes,
            "comments": comments,
            "Start_TimeStamps": Start_TimeStamps,
            "End_TimeStamps": End_TimeStamps,
            "AHT_Mins": AHT_Mins,
            "AHT_Secs": AHT_Secs,
            "Search_Types": Search_Types,
            "Source_Of_Searchs": Source_Of_Searchs,
            "Search_Keywords": Search_Keywords
        }
    except Exception as e:
        return {"error": f"Failed to read Google Sheet: {str(e)}"}

@app.get("/get-match-data/")
async def get_match_data():
    try:
        scope = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
        # Importing credentials
        creds = Credentials.from_service_account_file("credentials.json", scopes=scope)
        client = gspread.authorize(creds)
        sheet = client.open_by_key("1l-zGWVR_Oz8POVV2Y_kvd2sSDlhFGV3kUG_IQF-7Umg").worksheet("Dropdown Config PC")
        all_values = sheet.get('A1:C', value_render_option='FORMATTED_VALUE')
        
        headers = all_values[0]
        if headers != ['Match type', 'Match_Type_Comments', 'Notes']:
            return {"error": "Invalid headers in Dropdown Config PV sheet"}
        
        match_types = sorted(set(row[0] for row in all_values[1:] if row[0]))
        match_data = []
        for row in all_values[1:]:
            if len(row) == 3 and all(row):
                match_data.append({
                    "match_type": row[0],
                    "match_type_comments": row[1],
                    "notes": row[2]
                })
        
        search_type = ["Google", "Competitor", "Image Search"]
        source_of_search = [
            "ISBN/EAN",
            "UPC",
            "Title",
            "Title + Brand",
            "Title + Model",
            "Brand + Model",
            "Custom Title + Brand",
            "Custom Title + Model",
            "Custom Title",
            "Custom Title + Brand + Model",
            "Google Image Search"
        ]
        
        return {
            "match_types": match_types,
            "match_data": match_data,
            "search_type": search_type,
            "source_of_search": source_of_search
        }
    except Exception as e:
        return {"error": f"Failed to read Dropdown Config PV sheet: {str(e)}"}

@app.post("/submit-match/")
async def submit_match(request: Request):
    try:
        data = await request.json()
        scope = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
        # Importing credentials
        creds = Credentials.from_service_account_file("credentials.json", scopes=scope)
        client = gspread.authorize(creds)

        # Importing the Final output sheet
        sheet = client.open_by_key("1RHEpq4k2tVgs4cQMYBtrwqOsXVZpU2KIPM0-Ct-vbcE").sheet1
        all_values = sheet.get('A1:AC', value_render_option='FORMATTED_VALUE')
        
        headers = all_values[0]
        item_id_index = headers.index("Item_Id") if "Item_Id" in headers else None
        assignee_index = headers.index("Assignee L2") if "Assignee L2" in headers else None
        if item_id_index is None or assignee_index is None:
            return {"error": "Required headers ('Item_Id', 'Assignee L2') not found in sheet"}

        # Find matching row
        row_index = None
        for i, row in enumerate(all_values[1:], start=2):
            if (len(row) > item_id_index and row[item_id_index] == data["itemId"] and
                len(row) > assignee_index and row[assignee_index] == data["l2assignee"]):
                row_index = i
                break
        
        if row_index is None:
            return {"error": f"No matching row found for Item_Id: {data['itemId']}, L2 Assignee: {data['l2assignee']}"}
        
        # Importing Client sheet
        metadata_url = f"https://www.googleapis.com/drive/v3/files/1KxtFsWBQH-y683g3CBgnJWWNC4hAYapH?fields=mimeType"
        headers_client = {"Authorization": f"Bearer {creds.token}"}
        response_client = requests.get(metadata_url, headers=headers_client)
        if response_client.status_code == 401:
            print("Token expired, refreshing...")
            creds.refresh(Request())
            headers = {"Authorization": f"Bearer {creds.token}"}
            response_client = requests.get(metadata_url, headers=headers_client)

        if response_client.status_code != 200:
            return JSONResponse(status_code=500, content={"error": "Failed to get file metadata."})

        mime_type = response_client.json().get("mimeType")
        print(f"File MIME type: {mime_type}")

        rows_client = []
        if mime_type == "application/vnd.google-apps.spreadsheet":
            print("File is a Google Sheet.")
            sheet_client = client.open_by_key("1KxtFsWBQH-y683g3CBgnJWWNC4hAYapH").sheet1
            all_values = sheet_client.get_all_values()
            headers_row_client = all_values[0]
            rows_client = all_values[1:]

        else:
            download_url = f"https://www.googleapis.com/drive/v3/files/1KxtFsWBQH-y683g3CBgnJWWNC4hAYapH?alt=media"
            print("File is an Excel file.")
            response_client = requests.get(download_url, headers=headers_client)
            if response_client.status_code != 200:
                return JSONResponse(status_code=500, content={"error": "Failed to download Excel file from Drive."})

            with tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx") as tmp:
                tmp.write(response_client.content)
                tmp_path = tmp.name

            try:
                workbook = openpyxl.load_workbook(tmp_path)
                sheet_client = workbook.active
                headers_row_client = [cell.value for cell in next(sheet_client.iter_rows(min_row=1, max_row=1))]
                rows_client = [[cell.value for cell in row] for row in sheet_client.iter_rows(min_row=2)]
            finally:
                os.remove(tmp_path)

        # Removing "" from item_id in client sheet
        def clean_str(s):
            if s is None:
               return ""
            return str(s).strip().strip('"').strip("'")
        
        # Find matching row in Client sheet
        item_id_index_client = headers_row_client.index("Item_Id") if "Item_Id" in headers_row_client else None
        row_index_client = None
        for i, row in enumerate(rows_client[1:]):
            if (len(row) > item_id_index_client and clean_str(row[item_id_index_client]) == data["itemId"]):
                row_index_client = i
        # print(rows_client[row_index_client+1][item_id_index_client])
        # retailer_id_index_client = headers_row_client.index("Retailer_Id")
        # print(retailer_id_index_client)
        # print(rows_client[row_index_client+1][retailer_id_index_client])

        # Prepare row data
        row_data = [""] * max(len(headers), 29)
        for idx, header in enumerate(headers):
            if header == "Sl. No":
                row_data[idx] = data.get("taskSerial", "")
            elif header == "Item_Id":
                row_data[idx] = data.get("itemId", "")
            elif header == "Assignee L2":
                row_data[idx] = data.get("l2assignee", "")
            elif header == "Assignee":
                row_data[idx] = data.get("assignee", "")
            elif header == "TASK STATE":
                row_data[idx] = "Submit"
            elif header == "Status":
                row_data[idx] = "Done"
            elif header == "Walmart_Url":
                row_data[idx] = data.get("walmartUrl", "")
            elif header == "Comp_Url":
                row_data[idx] = data.get("competitorUrl", "")
            elif header == "Match_Type":
                row_data[idx] = data.get("matchType", "")
            elif header == "Match_Type_Comments":
                row_data[idx] = data.get("matchTypeComments", "")
            elif header == "Notes":
                row_data[idx] = data.get("notes", "")
            elif header == "Comments":
                row_data[idx] = data.get("comments", "")
            elif header == "Start TimeStamp":
                row_data[idx] = data.get("startTimestamp", "")
            elif header == "End TimeStamp":
                row_data[idx] = data.get("endTimestamp", "")
            elif header == "AHT(in Seconds)":
                row_data[idx] = str(data.get("ahtSeconds", ""))
            elif header == "AHT(In Min)":
                row_data[idx] = str(data.get("ahtMinutes", ""))
            elif header == "Search_Type":
                row_data[idx] = data.get("searchType", "")
            elif header == "Source_Of_Search":
                row_data[idx] = data.get("sourceOfSearch", "")
            elif header == "Search_Keyword":
                row_data[idx] = data.get("searchKeyword", "")
            elif header == "Walmart_UPC":
                walmart_upc_index_client = headers_row_client.index("Walmart_UPC")
                row_data[idx] = rows_client[row_index_client+1][walmart_upc_index_client]
            elif header == "Item_Id":
                item_id_index_client = headers_row_client.index("Item_Id")
                row_data[idx] = rows_client[row_index_client+1][item_id_index_client]
            elif header == "Retailer_Id":
                retailer_id_index_client = headers_row_client.index("Retailer_Id")
                row_data[idx] = rows_client[row_index_client+1][retailer_id_index_client]
            elif header == "Super_Department":
                Super_Department_index_client = headers_row_client.index("Super_Department")
                row_data[idx] = rows_client[row_index_client+1][Super_Department_index_client]
            elif header == "Department":
                Department_index_client = headers_row_client.index("Department")
                row_data[idx] = rows_client[row_index_client+1][Department_index_client]
            elif header == "Product_Type":
                Product_Type_index_client = headers_row_client.index("Product_Type")
                row_data[idx] = rows_client[row_index_client+1][Product_Type_index_client]
            elif header == "Walmart_Url":
                Walmart_Url_index_client = headers_row_client.index("Walmart_Url")
                row_data[idx] = rows_client[row_index_client+1][Walmart_Url_index_client]
            elif header == "Walmart_Info":
                Walmart_Info_index_client = headers_row_client.index("Walmart_Info")
                row_data[idx] = rows_client[row_index_client+1][Walmart_Info_index_client]
            elif header == "Item_Name":
                Item_Name_index_client = headers_row_client.index("Item_Name")
                row_data[idx] = rows_client[row_index_client+1][Item_Name_index_client]
            elif header == "Brand_Name":
                Brand_Name_index_client = headers_row_client.index("Brand_Name")
                row_data[idx] = rows_client[row_index_client+1][Brand_Name_index_client]

        # print(row_data)

        # Update the row in the Final output sheet
        sheet.update(f"A{row_index}:AC{row_index}", [row_data])


        # Importing the product coverage sheet
        sheet2 = client.open_by_key("1Qg9iJGUAxSacy-SflMbcsM_nXkT79JcWdqEwGBRrnWY").sheet1
        all_values2 = sheet2.get('A1:Z', value_render_option='FORMATTED_VALUE')
        submit2index = all_values2[0].index("Submit")
        # print(submit2index)
        item_id2_index = all_values2[0].index("Item_Id")
        sheet2rowIndex = None
        for i, item_id in enumerate(all_values2[1:], start=2):
            if (len(item_id) > item_id2_index and item_id[item_id2_index] == data["itemId"]):
                sheet2rowIndex = i
        # print(sheet2rowIndex)
       
        # Update the column Submit in product coverage sheet
        sheet2.update_cell(sheet2rowIndex, submit2index+1, "Submit")

        return {"message": "All details are saved"}
    except Exception as e:
        return {"error": f"Failed to update Google Sheet: {str(e)}"}