const url = "https://docs.google.com/document/d/164Uk-aiEEMVah4YXXr_DLv6wdPOXZ3hS/edit?usp=sharing&ouid=106902644948559797879&rtpof=true&sd=true";
const proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`;

console.log("Fetching from:", proxyUrl);
fetch(proxyUrl)
  .then(r => {
    console.log("Response status:", r.status);
    return r.text();
  })
  .then(html => {
    console.log("HTML content:", html);
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    console.log("Title match:", match ? match[0] : "null");
    if (match) {
      console.log("Title content:", match[1]);
    }
  })
  .catch(err => {
    console.error("Error:", err);
  });
