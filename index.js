addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function extractLinks(url) {
  const links = [];
  await new HTMLRewriter()
    .on('a', {
      element(element) {
        if (element.hasAttribute('href')) {
          let url = element.getAttribute('href');
          const hashIndex = url.indexOf('#');
          if (hashIndex !== -1) {
            url = url.slice(0, hashIndex);
          }
          if (!links.includes(url)) {
            links.push(url);
          }
        }
      },
    })
    .transform(await fetch(url))
    .text();
  return links;
}

async function scrapePage(url) {
  const res = await fetch(url);
  const status = res.status;
  let title = '';
  await new HTMLRewriter()
    .on('head > title', {
      text(node) {
        title += node.text;
      },
    })
    .transform(res)
    .text();
  return {
    url,
    status,
    title: title.trim(),
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

  const a = [];
  const links = await extractLinks(`https://${params.s}${params.p || '/'}`);
  for (const l of links) {
    if (l.startsWith(`https://${params.s}/`)) {
      a.push(scrapePage(l));
    } else if (!l.startsWith('http')) {
      a.push(scrapePage(`https://${params.s}${l}`));
    }
    if (a.length === 20) {
      break;
    }
  }

  const results = await Promise.all(a);

  return new Response(JSON.stringify(results), {
    headers: {
      'content-type': 'text/plain;charset=UTF-8',
    },
  });
}
