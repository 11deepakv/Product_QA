document.addEventListener('DOMContentLoaded', async () => {
    // console.log('DOM loaded, initializing Date/Time and dropdowns');

    // Store Walmart URL and Start Timestamp
    let walmartUrl = '';
    let startTimestamp = '';
    let sheetData = null; // Store sheet data for filtering

    // Date/Time Update
    function updateDateTime() {
        try {
            const timeElement = document.getElementById('current-time');
            if (!timeElement) {
                console.error('Date/Time element not found');
                return;
            }
            const now = new Date();
            let formattedTime;
            try {
                const options = {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true
                };
                formattedTime = now.toLocaleString('en-US', options);
            } catch (error) {
                console.warn('toLocaleString failed, using fallback format:', error);
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const hours = String(now.getHours() % 12 || 12).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
                formattedTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${ampm}`;
            }
            timeElement.textContent = formattedTime;
        } catch (error) {
            console.error('Error updating Date/Time:', error);
        }
    }
    setTimeout(() => {
        updateDateTime();
        // console.log('Started Date/Time interval');
        setInterval(updateDateTime, 1000);
    }, 500);

    // Google Sheets Data Fetch
    try {
        // console.log('Fetching Google Sheet data');
        const response = await fetch('/get-sheet-data/');
        sheetData = await response.json();
        // console.log('Google Sheet data fetched:', sheetData);

        if (sheetData.error) {
            console.error('Google Sheet error:', sheetData.error);
            alert('Failed to load Google Sheet data.');
            return;
        }

        // Initialize dropdowns
        const l2assigneeSelect = document.getElementById('l2assignee');
        const assigneeSelect = document.getElementById('assignee');
        const taskSerialSelect = document.getElementById('taskSerial');
        const itemIdSelect = document.getElementById('itemId');
        const totalTasksSpan = document.getElementById('total-itemIds');

        // Populate l2_assignee dropdown
        sheetData.l2_assignees.forEach(l2_assignee => {
            const option = document.createElement('option');
            option.value = l2_assignee;
            option.textContent = l2_assignee;
            l2assigneeSelect.appendChild(option);
        });

        // Function to update taskSerial and itemId dropdowns
        function updateDropdowns(selectedAssignee) {
            // console.log('Updating dropdowns for Assignee:', selectedAssignee || 'None');

            // Clear existing options
            taskSerialSelect.innerHTML = '<option value="">Select Task Serial Number</option>';
            itemIdSelect.innerHTML = '<option value="">Select Item ID</option>';
            assigneeSelect.innerHTML = '<option value="">Select L1 Assignee</option>';

            let filteredSerials = sheetData.serial_numbers;
            let filteredItemIds = [];
            let totalTasks = filteredSerials.length;
            let pendingTasks = 0;

            if (selectedAssignee && selectedAssignee.trim()) {
                const assigneeIndex = sheetData.headers.indexOf('Assignee L2');
                const slNoIndex = sheetData.headers.indexOf('Sl. No');
                const itemIdIndex = sheetData.headers.indexOf('Item_Id');
                const taskStatusIndex = sheetData.headers.indexOf('Submit');
                const assigneel1Index = sheetData.headers.indexOf('Assignee')

                filteredSerials = [];
                filteredItemIds = [];
                filteredAssignees = [];
                totalTasks = 0;

                sheetData.rows.forEach(row => {
                    if (row[assigneeIndex] === selectedAssignee) {
                        if (row[slNoIndex] && row[itemIdIndex]) {
                            // Only include serials, assigneesl1 and item IDs with valid Item_Id and TASK STATE !== "Submit"
                            if (!taskStatusIndex || row[taskStatusIndex] !== 'Submit') {
                                filteredSerials.push(row[slNoIndex]);
                                filteredItemIds.push(row[itemIdIndex]);
                                filteredAssignees.push(row[assigneel1Index])
                                pendingTasks++;
                            }
                        }
                        totalTasks++;
                    }
                });

                filteredSerials = [...new Set(filteredSerials)].sort();
                filteredItemIds = [...new Set(filteredItemIds)].sort();
                // filteredAssignees = [...new Set(filteredAssignees)].sort()
            } else {
                // No assignee selected: filter out TASK STATE === "Submit"
                const itemIdIndex = sheetData.headers.indexOf('Item_Id');
                const assigneel1Index = sheetData.headers.indexOf('Assignee')
                const taskStatusIndex = sheetData.headers.indexOf('Submit');
                filteredItemIds = sheetData.item_ids.filter(id => {
                    const row = sheetData.rows.find(row => row[itemIdIndex] === id);
                    return row && (!taskStatusIndex || row[taskStatusIndex] !== 'Submit');
                }).sort();
                filteredAssignees = sheetData.assignees.filter(assignee=>{
                    const row = sheetData.rows.find(row => row[assigneel1Index] === assignee);
                    return row && (!assigneel1Index || row[assigneel1Index] !== 'Submit');
                })
                pendingTasks = filteredItemIds.length;
            }

            // totalTasks = filteredItemIds.length;

            // console.log('Filtered Serials:', filteredSerials);
            // console.log('Filtered Item IDs:', filteredItemIds);

            // Populate taskSerial dropdown
            filteredSerials.forEach(serial => {
                const option = document.createElement('option');
                option.value = serial;
                option.textContent = serial;
                taskSerialSelect.appendChild(option);
            });

            // Populate itemId dropdown
            filteredItemIds.forEach(id => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = id;
                itemIdSelect.appendChild(option);
            });

            filteredAssignees.forEach(l1assignee =>{
                const option = document.createElement('option');
                option.value = l1assignee;
                option.textContent = l1assignee;
                assigneeSelect.appendChild(option)
            })

            // Update task counts
            totalTasksSpan.innerHTML = `<b>Total Tasks:</b> ${totalTasks} | <b>Pending Tasks:</b> ${pendingTasks}`;

            // Safely destroy Select2 only if initialized
            if ($('#taskSerial').hasClass('select2-hidden-accessible')) {
                $('#taskSerial').select2('destroy');
            }
            if ($('#itemId').hasClass('select2-hidden-accessible')) {
                $('#itemId').select2('destroy');
            }

            if ($('#assignee').hasClass('select2-hidden-accessible')) {
                $('#assignee').select2('destroy');
            }

            // Reinitialize Select2
            $('#taskSerial').select2({
                placeholder: 'Select Task Serial Number',
                allowClear: true,
                closeOnSelect: true
            });
            $('#itemId').select2({
                placeholder: 'Select Item ID',
                allowClear: true,
                closeOnSelect: true
            });

            $('#assignee').select2({
                placeholder: 'Select L1 Assignee',
                allowClear: true,
                closeOnSelect: true
            });


            // Clear selections and ensure itemId is enabled
            $('#taskSerial').val('').trigger('change');
            $('#itemId').val('').trigger('change');
            $('#assignee').val('').trigger('change');
            
            $('#itemId').prop('disabled', true);
            $('#assignee').prop('disabled', true);
            // Clear urlInput
            const urlInput = document.querySelector('#urlInput input[name="url"]');
            if (urlInput) urlInput.value = '';
        }

        // Initialize all dropdowns with Select2
        $('#l2assignee').select2({
            placeholder: 'Select L2 Assignee',
            allowClear: true,
            closeOnSelect: true
        });
        $('#taskSerial').select2({
            placeholder: 'Select Task Serial Number',
            allowClear: true,
            closeOnSelect: true
        });
        $('#itemId').select2({
            placeholder: 'Select Item ID',
            allowClear: true,
            closeOnSelect: true
        });

        $('#assignee').select2({
            placeholder: 'Select L1 Assignee',
            allowClear: true,
            closeOnSelect: true
        });

        // Clear any default assignee selection
        $('#l2assignee').val('').trigger('change');
        // console.log('Initial L2 Assignee cleared');
        
        // Populate taskSerial and itemId with all values
        updateDropdowns(null);

        // Handle assignee change
        $('#l2assignee').on('select2:select select2:clear', function () {
            const selectedAssignee = $(this).val();
            $('#taskSerial').val('').trigger('change');
            $('#itemId').val('').trigger('change');
            $('#itemId').prop('disabled', true);
            $('#assignee').prop('disabled', true);
            const urlInput = document.querySelector('#urlInput input[name="url"]');
            if (urlInput) urlInput.value = '';
            updateDropdowns(selectedAssignee);
        });

        // Force update on clicking the same assignee
        $('#l2assignee').on('select2:open', function () {
            const currentValue = $(this).val();
            $(this).one('select2:close', function () {
                const newValue = $(this).val();
                $('#taskSerial').val('').trigger('change');
                $('#itemId').val('').trigger('change');
                $('#itemId').prop('disabled', true);
                $('#assignee').prop('disabled', true);
                const urlInput = document.querySelector('#urlInput input[name="url"]');
                if (urlInput) urlInput.value = '';
                updateDropdowns(newValue || null);
                // console.log('l2 Assignee dropdown closed, updated for:', newValue || 'None');
            });
        });

        // Handle taskSerial change for auto-selecting itemId
        $('#taskSerial').on('select2:select', function () {
            const serial = $(this).val();
            const assignee = $('#l2assignee').val();
            const urlInput = document.querySelector('#urlInput input[name="url"]');
            if (serial && assignee) {
                const slNoIndex = sheetData.headers.indexOf('Sl. No');
                const itemIdIndex = sheetData.headers.indexOf('Item_Id');
                const assigneeIndex = sheetData.headers.indexOf('Assignee L2');
                const taskStatusIndex = sheetData.headers.indexOf('Submit');
                const l1assigneeIndex = sheetData.headers.indexOf('Assignee')
                const row = sheetData.rows.find(row =>
                    row[slNoIndex] === serial && row[assigneeIndex] === assignee
                );
                if (row && row[itemIdIndex] && (!taskStatusIndex || row[taskStatusIndex] !== 'Submit')) {
                    // Set value and force Select2 UI update
                    $('#itemId').val(row[itemIdIndex]).trigger('change.select2');
                    $('#assignee').val(row[l1assigneeIndex]).trigger('change.select2');
                    $('#itemId').prop('disabled', true);
                    $('#assignee').prop('disabled', true);
                    // Debug: Log itemId value and options
                    // console.log('Selected Item ID:', $('#itemId').val());
                    // console.log('Item ID Options:', Array.from(itemIdSelect.options).map(opt => opt.value));
                    // Explicitly set URL as fallback
                    if (urlInput) {
                        urlInput.value = `https://www.walmart.com/ip/${row[itemIdIndex]}?selected=true`;
                    }
                } else {
                    $('#itemId').val('').trigger('change.select2');
                    $('#itemId').prop('disabled', true);
                    $('#assignee').val('').trigger('change.select2');
                    $('#assignee').prop('disabled', true);
                    if (urlInput) urlInput.value = '';
                }
            } else {
                $('#itemId').val('').trigger('change.select2');
                $('#itemId').prop('disabled', false);
                $('#assignee').val('').trigger('change.select2');
                $('#assignee').prop('disabled', true);
                if (urlInput) urlInput.value = '';
            }
        });

        // Handle taskSerial clear
        $('#taskSerial').on('select2:clear', function () {
            $('#itemId').val('').trigger('change.select2');
            $('#itemId').prop('disabled', false);
            const urlInput = document.querySelector('#urlInput input[name="url"]');
            if (urlInput) urlInput.value = '';
        });

        // Handle itemId change for URL generation
        $('#itemId').on('select2:select select2:clear', function () {
            const selectedItemId = $(this).val();
            const urlInput = document.querySelector('#urlInput input[name="url"]');
            if (urlInput) {
                if (selectedItemId) {
                    urlInput.value = `https://www.walmart.com/ip/${selectedItemId}?selected=true`;
                } else {
                    urlInput.value = '';
                }
            } else {
                console.error('URL input element not found');
            }
        });

        console.log('Dropdowns initialized with select2');
    } catch (error) {
        console.error('Error fetching sheet data:', error);
        alert('Failed to load Google Sheet data.');
    }
});


document.getElementById('scrapeForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const resultsDiv = document.getElementById('results');
    const loader = document.getElementById('loader');
    walmartUrl = formData.get('url') || '';
    const now = new Date();
    startTimestamp = now.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).replace(',', '');
    loader.style.display = 'block';
    const matchFormDiv = document.getElementById(`match_form`);
    matchFormDiv.style.display = 'none';
    resultsDiv.innerHTML = '';
    try {
        const response = await fetch('/process/', {
            method: 'POST',
            body: formData
        });

        await updateFeedbackForm();  
        const resultHTML = await response.text();
        loader.style.display = 'none';
        resultsDiv.innerHTML = resultHTML;
    } catch (error) {
        console.error("Error processing form:", error);
        loader.style.display = 'none';
        resultsDiv.innerHTML = '<p class="error">Something went wrong. Please try again.</p>';
    }
});

async function updateFeedbackForm() {
    const matchFormDiv = document.getElementById(`match_form`);
    matchFormDiv.style.display = 'none';
    try {
        const response = await fetch('/get-sheet-data/');
        const sheetData = await response.json();
        const itemid = $('#itemId').val();
        console.log(itemid);
        await showMatchForm("0", matchFormDiv);
        rows = sheetData.rows;
        const itemIdIndex = sheetData.headers.indexOf('Item_Id');
        console.log(rows[0])
        rows.forEach(row => {
            if (row[itemIdIndex] === itemid) {
                Comp_Url_index = sheetData.headers.indexOf('Comp_Url');
                Match_Type_index = sheetData.headers.indexOf('Match_Type');
                Match_Type_Comments_index = sheetData.headers.indexOf('Match_Type_Comments');
                Notes_index = sheetData.headers.indexOf('Notes');
                Comments_index = sheetData.headers.indexOf('Comments');
                Search_Type_index = sheetData.headers.indexOf('Search_Type');
                Source_Of_Search_index = sheetData.headers.indexOf('Source_Of_Search');
                Search_Keyword_index = sheetData.headers.indexOf('Search_Keyword');

                if (row[Comp_Url_index]) {
                    competitorUrl = row[Comp_Url_index];
                    const competitor_urlSelect = document.getElementById(`competitor_url_0`);
                    const option = document.createElement('option');
                    option.value = competitorUrl;
                    option.textContent = competitorUrl;
                    competitor_urlSelect.appendChild(option);
                    $('#competitor_url_0').val(competitorUrl).trigger('change.select2');
                    $(`#competitor_url_0`).prop('disabled', true);
                }
                if (row[Match_Type_index]) {
                    matchType = row[Match_Type_index];
                    if(matchType === "Exact Match"){
                        const exact_match_fieldSelect = document.getElementById('exact_match_fields_0');
                        exact_match_fieldSelect.style.display = 'block'
                    }
                    const matchTypeSelect = document.getElementById('match_type_0');
                    const option = document.createElement('option');
                    option.value = matchType;
                    option.textContent = matchType;
                    matchTypeSelect.appendChild(option);
                    $('#match_type_0').val(matchType).trigger('change.select2');
                    $(`#match_type_0`).prop('disabled', true);
                }
                if (row[Match_Type_Comments_index]) {
                    matchTypeComments = row[Match_Type_Comments_index];
                    const matchTypeCommentsSelect = document.getElementById('match_type_comments_0');
                    const option = document.createElement('option');
                    option.value = matchTypeComments;
                    option.textContent = matchTypeComments;
                    matchTypeCommentsSelect.appendChild(option);
                    $('#match_type_comments_0').val(matchTypeComments).trigger('change.select2');
                    $(`#match_type_comments_0`).prop('disabled', true);
                }
                if (row[Notes_index]) {
                    notes = row[Notes_index];
                    const notesSelect = document.getElementById('notes_0');
                    const option = document.createElement('option');
                    option.value = notes;
                    option.textContent = notes;
                    notesSelect.appendChild(option);
                    $('#notes_0').val(notes).trigger('change.select2');
                    $(`#notes_0`).prop('disabled', true);
                }
                if (row[Comments_index]) {
                    comments = row[Comments_index];
                    const commentsSelect = document.getElementById('comment_0');
                    const option = document.createElement('option');
                    option.value = comments;
                    option.textContent = comments;
                    commentsSelect.appendChild(option);
                    $('#comment_0').val(comments).trigger('change.select2');
                    $(`#comment_0`).prop('disabled', true);
                }
                if (row[Search_Type_index]) {
                    searchType = row[Search_Type_index];
                    const searchTypeSelect = document.getElementById('search_type_0');
                    const option = document.createElement('option');
                    option.value = searchType;
                    option.textContent = searchType;
                    searchTypeSelect.appendChild(option);
                    $('#search_type_0').val(searchType).trigger('change.select2');
                    $(`#search_type_0`).prop('disabled', true);
                }
                if (row[Source_Of_Search_index]) {
                    sourceOfSearch = row[Source_Of_Search_index];
                    const sourceOfSearchSelect = document.getElementById('source_of_search_0');
                    const option = document.createElement('option');
                    option.value = sourceOfSearch;
                    option.textContent = sourceOfSearch;
                    sourceOfSearchSelect.appendChild(option);
                    $('#source_of_search_0').val(sourceOfSearch).trigger('change.select2');
                    $(`#source_of_search_0`).prop('disabled', true);
                }
                if (row[Search_Keyword_index]) {
                    searchKeyword = row[Search_Keyword_index];
                    const searchKeywordInput = document.getElementById('search_keyword_0');
                    const option = document.createElement('option');
                    option.value = searchKeyword;
                    option.textContent = searchKeyword;
                    searchKeywordInput.appendChild(option);
                    $('#search_keyword_0').val(searchKeyword).trigger('change.select2');
                    $(`#search_keyword_0`).prop('disabled', true);
                }

            }
        });
    } catch (error) {
        console.error('Error fetching match data:', error);
        alert('Failed to load match data.');
    }
}

async function searchAmazon(part1, part2, part3, searchType, idx) {
    const loader = document.getElementById('loader');
    const linkDiv = document.getElementById(`amazon_link_${idx}`);
    const linkDiv2 = document.getElementById(`google_link_${idx}`);
    const linkDiv3 = document.getElementById(`ebay_link_${idx}`);
    const linkDiv4 = document.getElementById(`target_link_${idx}`);
    const linkDiv5 = document.getElementById(`bestbuy_link_${idx}`);
    const linkDiv6 = document.getElementById(`wayfair_link_${idx}`);
    const matchFormDiv = document.getElementById(`match_form_${idx}`);
    loader.style.display = 'block';
    try {
        const response = await fetch('/search/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                part1: part1,
                part2: part2,
                part3: part3,
                search_type: searchType
            })
        });
        const result = await response.json();
        const link = result.amazon_url;
        const link2 = result.google_url;
        const link3 = result.ebay_url;
        const link4 = result.target_url;
        const link5 = result.bestbuy_url;
        const link6 = result.wayfair_url;
        loader.style.display = 'none';
        if (linkDiv && link && link !== "Not Found") {
            linkDiv.innerHTML = `<b>Amazon Result Page: </b><a href="${link}" target="_blank">Open Amazon Product</a>`;
            window.open(link, '_blank');
        } else {
            linkDiv.innerHTML = `<span class="error">Amazon Link not Found.</span>`;
        }
        if (linkDiv2 && link2 && link2 !== "Not Found") {
            linkDiv2.innerHTML = `<b>Google Result Page: </b><a href="${link2}" target="_blank">Open Google Page</a>`;
            window.open(link2, '_blank');
        } else {
            linkDiv2.innerHTML = `<span class="error">Google Link not Found.</span>`;
        }
        if (linkDiv3 && link3 && link3 !== "Not Found") {
            linkDiv3.innerHTML = `<b>eBay Result Page: </b><a href="${link3}" target="_blank">Open eBay Product</a>`;
        } else {
            linkDiv3.innerHTML = `<span class="error">eBay Link not Found.</span>`;
        }
        if (linkDiv4 && link4 && link4 !== "Not Found") {
            linkDiv4.innerHTML = `<b>Target Result Page: </b><a href="${link4}" target="_blank">Open Target Product</a>`;
        } else {
            linkDiv4.innerHTML = `<span class="error">Target Link not Found.</span>`;
        }
        if (linkDiv5 && link5 && link5 !== "Not Found") {
            linkDiv5.innerHTML = `<b>Best Buy Result Page: </b><a href="${link5}" target="_blank">Open Best Buy Product</a>`;
        } else {
            linkDiv5.innerHTML = `<span class="error">Best Buy Link not Found.</span>`;
        }
        if (linkDiv6 && link6 && link6 !== "Not Found") {
            linkDiv6.innerHTML = `<b>Wayfair Result Page: </b><a href="${link6}" target="_blank">Open Wayfair Product</a>`;
        } else {
            linkDiv6.innerHTML = `<span class="error">Wayfair Link not Found.</span>`;
        }

        // Show match form
        // await showMatchForm(idx, matchFormDiv);
    } catch (error) {
        console.error("Error searching:", error);
        loader.style.display = 'none';
        linkDiv.innerHTML = '<p class="error">Something went wrong with Amazon search.</p>';
        linkDiv2.innerHTML = '<p class="error">Something went wrong with Google search.</p>';
        linkDiv3.innerHTML = '<p class="error">Something went wrong with eBay search.</p>';
        linkDiv4.innerHTML = '<p class="error">Something went wrong with Target search.</p>';
        linkDiv5.innerHTML = '<p class="error">Something went wrong with Best Buy search.</p>';
        linkDiv6.innerHTML = '<p class="error">Something went wrong with Wayfair search.</p>';
    }
}

async function openGoogleLens(imageUrl, idx) {
    const matchFormDiv = document.getElementById(`match_form_${idx}`);
    try {
        const googleLensUrl = `https://lens.google.com/uploadbyurl?url=${imageUrl}`;
        window.open(googleLensUrl, '_blank');
        console.log("Opening Google Lens");
        console.log("Google Lens URL:", googleLensUrl);

        // Show match form
        // await showMatchForm(idx, matchFormDiv);
    } catch (error) {
        alert("Facing Error while opening Google Lens");
        console.error("Error opening Google Lens:", error);
    }
}

function validateAmazonUrl(url) {
    // Allow empty URL for validation (but required for submission)
    if (!url || url.trim() === '') return true;
    // Check for http://www.amazon.com/... or https://www.amazon.com/...
    const regex = /^https?:\/\/www\.amazon\.com\/.+/i;
    return regex.test(url);
}

async function showMatchForm(idx, matchFormDiv) {
    try {
        const response = await fetch('/get-match-data/');
        const data = await response.json();
        // console.log('Match data fetched:', data);

        if (data.error) {
            console.error('Match data error:', data.error);
            alert('Failed to load match data.');
            return;
        }

        // Log match_types and match_data for debugging
        // console.log('Match Types:', data.match_types);
        // console.log('Match Data:', data.match_data);

        // Generate form HTML
        matchFormDiv.innerHTML = `
            <div class="dropdown-row">
                <div>
                    <label for="match_type_${idx}">Match Type</label>
                    <select id="match_type_${idx}" class="select2" style="width: 100%;" required>
                        <option value="">Select Match Type</option>
                        ${data.match_types.map(type => `<option value="${type}">${type}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label for="match_type_comments_${idx}">Match Type Comments</label>
                    <select id="match_type_comments_${idx}" class="select2" style="width: 100%;" required>
                        <option value="">Select Match Type Comments</option>
                    </select>
                </div>
                <div>
                    <label for="notes_${idx}">Notes</label>
                    <select id="notes_${idx}" class="select2" style="width: 100%;" required>
                        <option value="">Select Notes</option>
                    </select>
                </div>
            </div>
            <div id="exact_match_fields_${idx}" style="display: none; margin-top: 12px;">
                <div class="dropdown-row">
                    <div>
                        <label for="search_type_${idx}">Search Type</label>
                    <select id="search_type_${idx}" class="select2" style="width: 100%;">
                        <option value="">Select Search Type</option>
                        ${data.search_type.map(type => `<option value="${type}">${type}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label for="source_of_search_${idx}">Source of Search</label>
                    <select id="source_of_search_${idx}" class="select2" style="width: 100%;">
                        <option value="">Select Source of Search</option>
                        ${data.source_of_search.map(source => `<option value="${source}">${source}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label for="search_keyword_${idx}">Search Keyword</label>
                    <input type="text" id="search_keyword_${idx}" placeholder="Enter Search Keyword">
                </div>
            </div>
            <div style="margin-top: 12px;">
                <label for="competitor_url_${idx}">Competitor URL</label>
                <input type="text" id="competitor_url_${idx}" placeholder="Enter Amazon URL (e.g., https://www.amazon.com/...)">
                <span id="competitor_url_error_${idx}" style="color: red; font-size: 0.8em; display: none;">Please enter a valid Amazon URL</span>
            </div>
        </div>
        <div style="margin-top: 12px;">
            <label for="comment_${idx}">Comment</label>
            <textarea id="comment_${idx}" placeholder="Enter Comment" rows="3"></textarea>
        </div>
        <div style="margin-top: 12px; display: flex;">
            <button id="approve" style="display: block; background-color: #28c951;" onclick="approveButton(this.id)">Approve</button>
            <button id="disapprove" style="display: block; margin-left: 10px; background-color: #fc4747;" onclick="disapproveButton(this.id)">Disapprove</button>
        </div>
        <div style="margin-top: 12px;">
            <button id="submit_match_${idx}" disabled style="display: none;">Submit</button>
        </div>
    `;
        matchFormDiv.style.display = 'block';

        // Initialize select2 with explicit closeOnSelect
        $(`#match_type_${idx}`).select2({
            placeholder: 'Select Match Type',
            allowClear: true,
            closeOnSelect: true
        });
        $(`#match_type_comments_${idx}`).select2({
            placeholder: 'Select Match Type Comments',
            allowClear: true,
            closeOnSelect: true
        });
        $(`#notes_${idx}`).select2({
            placeholder: 'Select Notes',
            allowClear: true,
            closeOnSelect: true
        });
        $(`#search_type_${idx}`).select2({
            placeholder: 'Select Search Type',
            allowClear: true,
            closeOnSelect: true
        });
        $(`#source_of_search_${idx}`).select2({
            placeholder: 'Select Source of Search',
            allowClear: true,
            closeOnSelect: true
        });

        // Enable/disable submit button
        function updateSubmitButton() {
            const matchType = $(`#match_type_${idx}`).val();
            const matchTypeComments = $(`#match_type_comments_${idx}`).val();
            const notes = $(`#notes_${idx}`).val();
            const searchType = $(`#search_type_${idx}`).val();
            const sourceOfSearch = $(`#source_of_search_${idx}`).val();
            const searchKeyword = document.getElementById(`search_keyword_${idx}`).value;
            const competitorUrl = document.getElementById(`competitor_url_${idx}`).value;
            const isExactMatch = matchType && matchType.trim().toLowerCase() === 'exact match';
            const submitButton = document.getElementById(`submit_match_${idx}`);
            const urlErrorSpan = document.getElementById(`competitor_url_error_${idx}`);

            // Validate Amazon URL for Exact Match
            const isValidAmazonUrl = validateAmazonUrl(competitorUrl);

            // Show/hide error message
            if (isExactMatch && competitorUrl && !isValidAmazonUrl) {
                urlErrorSpan.style.display = 'block';
            } else {
                urlErrorSpan.style.display = 'none';
            }

            // Require all fields for Exact Match, including valid Amazon URL
            const isValid = matchType && matchTypeComments && notes &&
                (!isExactMatch || (searchType && sourceOfSearch && searchKeyword && competitorUrl && isValidAmazonUrl));
            submitButton.disabled = !isValid;
        }

        // Handle Match Type change
        $(`#match_type_${idx}`).on('select2:select', function (e) {
            const matchType = $(this).val();
            const commentsSelect = document.getElementById(`match_type_comments_${idx}`);
            const notesSelect = document.getElementById(`notes_${idx}`);
            const exactMatchFields = document.getElementById(`exact_match_fields_${idx}`);
            commentsSelect.innerHTML = '<option value="">Select Match Type Comments</option>';
            notesSelect.innerHTML = '<option value="">Select Notes</option>';
            exactMatchFields.style.display = matchType && matchType.trim().toLowerCase() === 'exact match' ? 'block' : 'none';
            updateSubmitButton();

            if (matchType) {
                const comments = [...new Set(data.match_data
                    .filter(row => row.match_type && matchType && row.match_type.trim().toLowerCase() === matchType.trim().toLowerCase())
                    .map(row => row.match_type_comments)
                    .filter(comment => comment && comment.trim()))];
                console.log(`Filtered comments for Match Type "${matchType}":`, comments);
                if (comments.length === 0) {
                    commentsSelect.innerHTML = '<option value="">No comments available</option>';
                } else {
                    comments.forEach(comment => {
                        const option = document.createElement('option');
                        option.value = comment;
                        option.textContent = comment;
                        commentsSelect.appendChild(option);
                    });
                }
                // Reinitialize Match Type Comments
                if ($(`#match_type_comments_${idx}`).hasClass('select2-hidden-accessible')) {
                    $(`#match_type_comments_${idx}`).select2('destroy');
                }
                $(`#match_type_comments_${idx}`).select2({
                    placeholder: 'Select Match Type Comments',
                    allowClear: true,
                    closeOnSelect: true
                });
            }
            console.log(`Match Type selected: ${matchType}`);
        });

        // Handle Match Type clear
        $(`#match_type_${idx}`).on('select2:clear', function () {
            const commentsSelect = document.getElementById(`match_type_comments_${idx}`);
            const notesSelect = document.getElementById(`notes_${idx}`);
            const exactMatchFields = document.getElementById(`exact_match_fields_${idx}`);
            commentsSelect.innerHTML = '<option value="">Select Match Type Comments</option>';
            notesSelect.innerHTML = '<option value="">Select Notes</option>';
            exactMatchFields.style.display = 'none';
            updateSubmitButton();
            // Reinitialize Match Type Comments
            if ($(`#match_type_comments_${idx}`).hasClass('select2-hidden-accessible')) {
                $(`#match_type_comments_${idx}`).select2('destroy');
            }
            $(`#match_type_comments_${idx}`).select2({
                placeholder: 'Select Match Type Comments',
                allowClear: true,
                closeOnSelect: true
            });
            console.log('Match Type cleared');
        });

        // Handle Match Type Comments change
        $(`#match_type_comments_${idx}`).on('select2:select', function () {
            const matchType = document.getElementById(`match_type_${idx}`).value;
            const comments = $(this).val();
            const notesSelect = document.getElementById(`notes_${idx}`);
            notesSelect.innerHTML = '<option value="">Select Notes</option>';
            updateSubmitButton();

            if (matchType && comments) {
                const notes = [...new Set(data.match_data
                    .filter(row =>
                        row.match_type && matchType && row.match_type.trim().toLowerCase() === matchType.trim().toLowerCase() &&
                        row.match_type_comments && comments && row.match_type_comments.trim().toLowerCase() === comments.trim().toLowerCase()
                    )
                    .map(row => row.notes)
                    .filter(note => note && note.trim()))];
                console.log(`Filtered notes for Match Type "${matchType}", Comments "${comments}":`, notes);
                if (notes.length === 0) {
                    notesSelect.innerHTML = '<option value="">No notes available</option>';
                } else {
                    notes.forEach(note => {
                        const option = document.createElement('option');
                        option.value = note;
                        option.textContent = note;
                        notesSelect.appendChild(option);
                    });
                }
                // Reinitialize Notes
                if ($(`#notes_${idx}`).hasClass('select2-hidden-accessible')) {
                    $(`#notes_${idx}`).select2('destroy');
                }
                $(`#notes_${idx}`).select2({
                    placeholder: 'Select Notes',
                    allowClear: true,
                    closeOnSelect: true
                });
            }
            console.log(`Match Type Comments selected: ${comments}`);
        });

        // Handle Match Type Comments clear
        $(`#match_type_comments_${idx}`).on('select2:clear', function () {
            const notesSelect = document.getElementById(`notes_${idx}`);
            notesSelect.innerHTML = '<option value="">Select Notes</option>';
            updateSubmitButton();
            // Reinitialize Notes
            if ($(`#notes_${idx}`).hasClass('select2-hidden-accessible')) {
                $(`#notes_${idx}`).select2('destroy');
            }
            $(`#notes_${idx}`).select2({
                placeholder: 'Select Notes',
                allowClear: true,
                closeOnSelect: true
            });
            console.log('Match Type Comments cleared');
        });

        // Update submit button on input changes
        $(`#notes_${idx}, #search_type_${idx}, #source_of_search_${idx}`).on('select2:select select2:clear', updateSubmitButton);
        $(`#search_keyword_${idx}, #competitor_url_${idx}`).on('input', updateSubmitButton);

        // Real-time validation for Competitor URL
        $(`#competitor_url_${idx}`).on('input', function () {
            updateSubmitButton();
        });

        // Handle submit button
        document.getElementById(`submit_match_${idx}`).addEventListener('click', async () => {
            const loader = document.getElementById('loader');
            loader.style.display = 'block';
            try {
                const matchType = $(`#match_type_${idx}`).val();
                const isExactMatch = matchType && matchType.trim().toLowerCase() === 'exact match';
                const endTimestamp = new Date().toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                }).replace(',', '');
                const startDate = new Date(startTimestamp.replace(/(\d{2})-(\w{3})-(\d{4})/, '$2 $1, $3'));
                const endDate = new Date(endTimestamp.replace(/(\d{2})-(\w{3})-(\d{4})/, '$2 $1, $3'));
                const ahtSeconds = Math.round((endDate - startDate) / 1000);
                const ahtMinutes = Math.round(ahtSeconds / 60);

                const formData = {
                    l2assignee: $('#l2assignee').val() || '',
                    assignee: $('#assignee').val() || '',
                    taskSerial: $('#taskSerial').val() || '',
                    itemId: $('#itemId').val() || '',
                    walmartUrl: walmartUrl,
                    matchType: matchType || '',
                    matchTypeComments: $(`#match_type_comments_${idx}`).val() || '',
                    notes: $(`#notes_${idx}`).val() || '',
                    comments: document.getElementById(`comment_${idx}`).value || '',
                    startTimestamp: startTimestamp,
                    endTimestamp: endTimestamp,
                    ahtSeconds: ahtSeconds,
                    ahtMinutes: ahtMinutes,
                    searchType: isExactMatch ? $(`#search_type_${idx}`).val() || '' : '',
                    sourceOfSearch: isExactMatch ? $(`#source_of_search_${idx}`).val() || '' : '',
                    searchKeyword: isExactMatch ? document.getElementById(`search_keyword_${idx}`).value || '' : '',
                    competitorUrl: isExactMatch ? document.getElementById(`competitor_url_${idx}`).value || '' : ''
                };

                const response = await fetch('/submit-match/', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                const result = await response.json();
                loader.style.display = 'none';

                if (result.error) {
                    console.error('Submission error:', result.error);
                    alert(`Failed to save details: ${result.error}`);
                } else {
                    alert('All details are saved.');
                    window.location.reload();
                }
            } catch (error) {
                console.error('Error submitting form:', error);
                loader.style.display = 'none';
                alert('Failed to save details: Something went wrong.');
            }
        });
    } catch (error) {
        console.error('Error loading match form:', error);
        alert('Failed to load match form.');
    }
}

async function disapproveButton(id) {
    console.log("Disapprove button clicked");
    const matchFormDiv = document.getElementById(`match_form`);
    // await showMatchForm("0", matchFormDiv);
    $(`#match_type_0`).prop('disabled', false);
    $(`#search_keyword_0`).prop('disabled', false);
    $(`#competitor_url_0`).prop('disabled', false);
    $(`#match_type_comments_0`).prop('disabled', false);
    $(`#notes_0`).prop('disabled', false);
    $(`#comment_0`).prop('disabled', false);
    $(`#search_type_0`).prop('disabled', false);
    $(`#source_of_search_0`).prop('disabled', false);

    const approveButton = document.getElementById('approve');
    const disapproveButton = document.getElementById('disapprove');
    approveButton.style.display = 'none';
    disapproveButton.style.display = 'none';
    const submitButton = document.getElementById('submit_match_0');
    submitButton.style.display = 'block';
    submitButton.disabled = false;
}

async function approveButton(id) {
    console.log("Approve button clicked");

    const approveButton = document.getElementById('approve');
    const disapproveButton = document.getElementById('disapprove');
    approveButton.style.display = 'none';
    disapproveButton.style.display = 'none';
    const submitButton = document.getElementById('submit_match_0');
    submitButton.style.display = 'block';
    submitButton.disabled = false;
}