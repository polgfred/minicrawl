addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function extractLinks(url) {
  const links = [];
  await new HTMLRewriter()
    .on('a', {
      element(element) {
        if (element.hasAttribute('href')) {
          links.push(element.getAttribute('href'));
        }
      },
    })
    .transform(await fetch(url))
    .text();
  return links;
}

async function scrapePage(url) {
  console.log(url);
  let currentTag;
  let title = '';
  await new HTMLRewriter()
    .on('*', {
      element(element) {
        currentTag = element.tagName;
      },
      text(node) {
        if (currentTag === 'title') {
          title += node.text;
        }
      },
    })
    .transform(await fetch(url))
    .text();
  return {
    url,
    title,
  };
}

async function handleRequest(request) {
  const params = new URL(request.url).search
    .slice(1)
    .split('&')
    .reduce((params, p) => {
      const [k, v] = p.split('=');
      params[decodeURIComponent(k)] = decodeURIComponent(v);
      return params;
    }, {});

  if (!params.s) {
    return new Response('no site found', {
      headers: { 'content-type': 'text/plain' },
    });
  }

  if (!params.p) {
    params.p = '/';
  }

  const a = [];
  const links = await extractLinks(`https://${params.s}${params.p}`);
  for (const l of links) {
    if (l.startsWith(`https://${params.s}/`)) {
      a.push(scrapePage(l));
    } else if (!l.startsWith('http')) {
      a.push(scrapePage(`https://${params.s}${l}`));
    }
    if (a.length === 10) {
      break;
    }
  }

  const results = await Promise.all(a);

  return new Response(JSON.stringify(results), {
    headers: { 'content-type': 'text/plain' },
  });
}
