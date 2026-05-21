const url = "https://docs.google.com/document/d/164Uk-aiEEMVah4YXXr_DLv6wdPOXZ3hS/edit?usp=sharing&ouid=106902644948559797879&rtpof=true&sd=true";
const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

console.log("Fetching from:", proxyUrl);
fetch(proxyUrl)
  .then(r => r.json())
  .then(data => {
    console.log("Response data keys:", Object.keys(data));
    const contents = data.contents || "";
    console.log("Contents length:", contents.length);
    const match = contents.match(/<title[^>]*>([^<]+)<\/title>/i);
    console.log("Title match:", match ? match[0] : "null");
    if (match) {
      console.log("Title content:", match[1]);
    }
  })
  .catch(err => {
    console.error("Error:", err);
  });
