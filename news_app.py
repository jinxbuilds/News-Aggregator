import requests
import streamlit as st

API_KEY = "YOUR_API_KEY_HERE"
BASE_URL = "https://newsapi.org/v2/everything"

# Initialize page_size in session state
if "page_size" not in st.session_state:
    st.session_state["page_size"] = 5

def fetch_news(topic, page_size=5):
    params = {
        "q": topic,
        "apiKey": API_KEY,
        "pageSize": page_size,
        "sortBy": "publishedAt",
        "language": "en"
    }
    response = requests.get(BASE_URL, params=params)

    if response.status_code == 200:
        data = response.json()
        articles = data.get("articles", [])
        return articles
    else:
        st.error(f"Failed to fetch news articles. ({response.status_code})")
        return []

# UI and logic
st.title("Personal AI News Aggregator")

topic = st.text_input("Enter a topic to search for news articles:")

if topic:
    st.write(f"Fetching news articles for topic: {topic}")
    articles = fetch_news(topic, page_size=st.session_state["page_size"])
    
    if not articles:
        st.write("No articles found.")

    for article in articles:
        st.subheader(article['title'])
        st.write(article['description'])
        st.markdown(f"[Read more]({article['url']})")
    
    st.write(f"Total articles displayed: {len(articles)}")

    # Load More button
    if st.button("Load More"):
        st.session_state["page_size"] += 5
        st.rerun()
    
