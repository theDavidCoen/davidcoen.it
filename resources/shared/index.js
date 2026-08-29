(function () {
  const catalogEl = document.getElementById('catalog');
  const searchEl = document.getElementById('search');

  function badges(item) {
    const parts = [];
    if (item.client) parts.push(ResourcesSite.BADGE_CLIENT);
    if (item.network) parts.push(ResourcesSite.BADGE_NETWORK);
    if (item.sensitive) parts.push(ResourcesSite.BADGE_SENSITIVE);
    return parts.length ? ` ${parts.join(' ')}` : '';
  }

  function render(itemsBySection) {
    catalogEl.innerHTML = itemsBySection.map(({ category, items }) => {
      if (!items.length) return '';
      const list = items.map((item) => `
        <li data-tags="${ResourcesSite.escape((item.tags || []).join(' '))}">
          <a href="${item.href}">${ResourcesSite.escape(item.name)}</a>${badges(item)}
          — ${item.desc}
        </li>`).join('');
      return `<h2>${ResourcesSite.escape(category)}</h2><ul class="tool-list">${list}</ul>`;
    }).join('');
  }

  function filter(query) {
    const q = query.trim().toLowerCase();
    return window.RESOURCES_CATALOG.map((section) => ({
      category: section.category,
      items: section.items.filter((item) => {
        if (!q) return true;
        const hay = [item.name, item.desc, ...(item.tags || [])].join(' ').toLowerCase();
        return hay.includes(q);
      }),
    }));
  }

  function update() {
    render(filter(searchEl.value));
    document.querySelectorAll('.tool-list li').forEach((li) => {
      if (!searchEl.value.trim()) {
        li.classList.remove('hidden');
        return;
      }
      const tags = (li.getAttribute('data-tags') || '') + ' ' + li.textContent;
      li.classList.toggle('hidden', !tags.toLowerCase().includes(searchEl.value.trim().toLowerCase()));
    });
  }

  searchEl.addEventListener('input', update);
  update();
})();
