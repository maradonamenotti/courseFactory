import pypdf

def main():
    pdf_path = "../manual de marca maradona menotti.pdf"
    reader = pypdf.PdfReader(pdf_path)
    print(f"Number of pages: {len(reader.pages)}")
    
    text = ""
    for idx, page in enumerate(reader.pages):
        text += f"\n--- Page {idx + 1} ---\n"
        text += page.extract_text()
        
    with open("brand_book_text.txt", "w", encoding="utf-8") as f:
        f.write(text)
    print("Done! Brand book text extracted to brand_book_text.txt")

if __name__ == "__main__":
    main()
