let articles = [];
let read_articles = [];

function setup_groups() {
  let $container = document.getElementById("content");

  for (let shortcut of DATA.shortcuts) {
    let group = document.createElement("div");
    group.className = "group";
    $container.appendChild(group);

    let link = document.createElement("a");
    link.setAttribute("href", "https://" + shortcut.url);
    group.appendChild(link);

    let image = document.createElement("span");
    image.setAttribute("src", shortcut.name);

    const linkText = document.createTextNode(shortcut.name);
    link.appendChild(linkText);
  }
}

class FeedItem {
  constructor(title, link, date, feed_title, read_time) {
    this.title = title;
    this.link = link;
    this.mseconds = date.getTime();
    this.read_time = read_time;

    let hostname = feed_title;
    let elapsed = Math.trunc((Date.now() - this.mseconds) / 1000 / 60 / 60);
    this.summary = hostname + " - ";
    if (elapsed == 0) {
      this.summary += "less than an hour ago";
    } else if (elapsed > 24 * 30) {
      this.summary += Math.round(elapsed / 24 / 30) + " months ago";
    } else if (elapsed > 24) {
      this.summary += Math.round(elapsed / 24) + " days ago";
    } else {
      this.summary += elapsed + " hours ago";
    }
  }
}

function feed_add(title, description, url, read_time) {
  let feed = document.getElementById("feed_list");

  let feed_wrapper = document.createElement("div");
  feed_wrapper.setAttribute("class", "feed_item");
  feed.appendChild(feed_wrapper);

  let link_elem = document.createElement("a");
  link_elem.setAttribute("href", url);
  feed_wrapper.appendChild(link_elem);

  let title_elem = document.createElement("p");
  title_elem.setAttribute("class", "title");
  title_elem.innerHTML = title;
  link_elem.appendChild(title_elem);

  let desc_elem = document.createElement("p");
  desc_elem.setAttribute("class", "summary");
  link_elem.appendChild(desc_elem);

  let url_favicon = document.createElement("img");
  let hostname = get_hostname(url);
  url_favicon.setAttribute(
    "src",
    "https://s2.googleusercontent.com/s2/favicons?domain=" + hostname
  );
  url_favicon.setAttribute("class", "feed_favicon");

  let bottom_bar = document.createElement("div");
  bottom_bar.setAttribute("class", "bottom-bar");

  let read_time_elem = document.createElement("p");
  read_time_elem.setAttribute("class", "bottom");
  read_time_elem.innerHTML = read_time;
  bottom_bar.appendChild(read_time_elem);

  desc_elem.appendChild(url_favicon);
  desc_elem.innerHTML += " ";
  desc_elem.innerHTML += description;

  let read_button = document.createElement("button");
  read_button.setAttribute("class", "button");
  read_button.innerText = "Mark as read";
  read_button.onclick = () => {
    add_read_article(url);
  };
  bottom_bar.appendChild(read_button);
  feed_wrapper.appendChild(bottom_bar);
}

async function feed_mix() {
  let mixed_feeds = [];
  let promise_list = [];

  for (let feed of DATA.feeds)
    promise_list.push(feednami.load(feed.url));

  let feed_list = await Promise.all(
    promise_list.map(p => p.catch(error => null))
  );

  // create object
  for (let i in feed_list) {
    const feed = feed_list[i];
    const feed_title = DATA.feeds[i].name;

    if (feed == null) continue;
    let flist = [];

    for (let entry of feed.entries) {
      if (!entry.title || !entry.link || !entry.date) continue;
      let read_time = "-";
      if (entry.description && entry.description !== null)
        read_time =
          Math.ceil(entry.description.split(" ").length / 200) + " minutes";
      let feed_item = new FeedItem(
        entry.title,
        entry.link,
        new Date(entry.date),
        feed_title,
        read_time
      );
      flist.push(feed_item);
    }
    feed_list[i] = flist;
  }

  // sort
  for (let i in feed_list)
    feed_list[i] = filter_feed(
      feed_list[i].sort((a, b) => b.mseconds - a.mseconds),
      true
    );

  // interleave
  let j = 0;
  let did = false;
  while (true) {
    did = false;
    for (let i in feed_list) {
      if (feed_list[i].length > j) {
        mixed_feeds.push(feed_list[i][j]);
        did = true;
      }
    }
    ++j;
    if (!did) break;
  }

  return mixed_feeds;
}

function filter_feed(list, fromLocalStorage) {
  if (fromLocalStorage) {
    let rf = localStorage.getItem("read");
    if (rf == null) return list;
    read_articles = JSON.parse(rf);
  }
  return list.filter(l => !read_articles.includes(l.link));
}

function add_read_article(article) {
  if (!read_articles.includes(article)) {
    read_articles.push(article);
    console.log("read_articles.length:", read_articles.length);
    read_articles = read_articles.slice(
      Math.max(read_articles.length - 3000, 0)
    );
    populate_feed(articles);
    localStorage.setItem("read", JSON.stringify(read_articles));
  }
}

function feed_clean() {
  let feed = document.getElementById("feed_list");
  feed.innerHTML = null;
}

function populate_feed(list, fromLocalStorage = false) {
  feed_clean();
  for (let item of filter_feed(list, fromLocalStorage).slice(0, DATA.maxFeedNumber)) {
    feed_add(item.title, item.summary, item.link, item.read_time);
  }
}

function flashReloadButon() {
  let reloadButton = document.getElementById("reload-button");
  reloadButton.innerText = "Content reloaded";
  setTimeout(() => {
    reloadButton.innerText = "RELOAD";
  }, 2000);
}

function setup_feed(data, ignoreCache = false) {
  if (ignoreCache) {
    let reloadButton = document.getElementById("reload-button");
    reloadButton.innerText = "RELOADING";
  }
  const lut = localStorage.getItem("lastArticlesUpdateTime");
  if (lut == "null" || ignoreCache) {
    localStorage.setItem("lastArticlesUpdateTime", +new Date());
    feed_mix().then(mixed_feeds => {
      flashReloadButon();
      articles = mixed_feeds;
      populate_feed(mixed_feeds, true);
      localStorage.setItem("articles", JSON.stringify(articles));
    });
  } else {
    const cachedArticles = JSON.parse(localStorage.getItem("articles"));
    articles = cachedArticles;
    if (articles) populate_feed(articles, true);
    if (getHours(lut) > 48) {
      feed_mix().then(mixed_feeds => {
        localStorage.setItem("lastArticlesUpdateTime", +new Date());
        articles = mixed_feeds;
        populate_feed(mixed_feeds, true);
        localStorage.setItem("articles", JSON.stringify(articles));
      });
    }
  }
}

function fill_message() {
  setInterval(() => {
    document.getElementById("welcome-string").innerText = getTime();
  }, 100);
}

function main() {
  fill_message();
  setup_groups();
  setup_feed();
}

function inject() {
  let reloadButton = document.getElementById("reload-button");
  reloadButton.onclick = () => setup_feed(true);
}

var DATA;

new CustomStartStorage().get()
  .then(data => {
    DATA = data;

    main();
  });

window.onload = inject;
