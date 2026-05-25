const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxy7HvA5m-JyAMc87_e4fgcsi57-ZL-F4KQpx_a8sjyhjydhu2tQme8hd0SUIT0Ug/exec";

export async function getData(sheetName) {
    try {
        const response = await fetch(`${SCRIPT_URL}?sheet=${sheetName}`);
        const data = await response.json();
        if (data.error) {
            console.warn(`Lỗi khi tải sheet ${sheetName}:`, data.error);
            return [];
        }
        return data;
    } catch (error) {
        console.error("Lỗi kết nối API:", error);
        return [];
    }
}

export async function addData(sheetName, dataObj) {
    try {
        const payload = {
            action: "add",
            sheet: sheetName,
            data: dataObj
        };
        
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Lỗi khi gửi dữ liệu:", error);
        return { error: error.message };
    }
}

export async function getSettings() {
    try {
        const response = await fetch(`${SCRIPT_URL}?action=get_settings`);
        const data = await response.json();
        if (data.error) {
            console.warn(`Lỗi khi tải settings:`, data.error);
            return null;
        }
        return data;
    } catch (error) {
        console.error("Lỗi kết nối API:", error);
        return null;
    }
}

export async function updateSettings(settingsObj) {
    try {
        const payload = {
            action: "update_settings",
            settings: settingsObj
        };
        
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Lỗi khi cập nhật settings:", error);
        return { error: error.message };
    }
}

export async function updateRow(sheetName, idColumn, idValue, updateData) {
    try {
        const payload = {
            action: "update_row",
            sheet: sheetName,
            idColumn: idColumn,
            idValue: idValue,
            updateData: updateData
        };
        
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Lỗi khi cập nhật dòng:", error);
        return { error: error.message };
    }
}

export async function deleteData(sheetName, idColumn, idValue) {
    try {
        const payload = {
            action: "delete_row",
            sheet: sheetName,
            idColumn: idColumn,
            idValue: idValue
        };
        
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Lỗi khi xóa dòng:", error);
        return { error: error.message };
    }
}

export async function createSheet(sheetName, headers) {
    try {
        const payload = {
            action: "create_sheet",
            sheet: sheetName,
            headers: headers
        };
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (error) {
        return { error: error.message };
    }
}
