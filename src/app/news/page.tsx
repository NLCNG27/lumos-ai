"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import { ExternalLink, Plus, Minus, Bot } from "lucide-react";

interface Story {
    id: number;
    title: string;
    url: string;
    score: number;
    by: string;
    time: number;
    descendants: number;
    summary?: string;
    isSummarizing?: boolean;
    showSummary?: boolean;
    summaryError?: string;
}

export default function NewsPage() {
    const [topStories, setTopStories] = useState<Story[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTopStories() {
            try {
                setLoading(true);
                // Fetch the IDs of the top stories
                const response = await axios.get(
                    "https://hacker-news.firebaseio.com/v0/topstories.json"
                );
                const storyIds = response.data.slice(0, 10); // Get top 10 stories

                // Fetch details for each story
                const storyPromises = storyIds.map((id: number) =>
                    axios.get(
                        `https://hacker-news.firebaseio.com/v0/item/${id}.json`
                    )
                );

                const storyResponses = await Promise.all(storyPromises);
                const stories = storyResponses.map((response) => response.data);

                // Initialize with summarization state
                const storiesWithSummaryState = stories.map((story) => ({
                    ...story,
                    summary: undefined,
                    isSummarizing: false,
                    showSummary: false,
                    summaryError: undefined,
                }));

                setTopStories(storiesWithSummaryState);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching Hacker News stories:", err);
                setError("Failed to fetch news. Please try again later.");
                setLoading(false);
            }
        }

        fetchTopStories();
    }, []);

    function formatTime(timestamp: number) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleString();
    }

    async function generateSummary(index: number) {
        const story = topStories[index];

        if (story.summary) {
            setTopStories((prev) =>
                prev.map((s, i) =>
                    i === index ? { ...s, showSummary: !s.showSummary } : s
                )
            );
            return;
        }

        setTopStories((prev) =>
            prev.map((s, i) =>
                i === index
                    ? {
                          ...s,
                          isSummarizing: true,
                          showSummary: true,
                          summaryError: undefined,
                      }
                    : s
            )
        );

        try {
            const response = await axios.post("/api/summary", {
                url: story.url,
                title: story.title,
            });

            // Update with the generated summary
            setTopStories((prev) =>
                prev.map((s, i) =>
                    i === index
                        ? {
                              ...s,
                              summary: response.data.summary,
                              isSummarizing: false,
                          }
                        : s
                )
            );
        } catch (err) {
            console.error("Error generating summary:", err);
            setTopStories((prev) =>
                prev.map((s, i) =>
                    i === index
                        ? {
                              ...s,
                              isSummarizing: false,
                              summaryError: "Failed to generate summary",
                          }
                        : s
                )
            );
        }
    }

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">News</h1>

            {loading && (
                <div className="flex justify-center my-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            )}

            {error && (
                <div className="bg-red-900/30 border border-red-800 text-red-200 px-4 py-3 rounded">
                    {error}
                </div>
            )}

            {!loading && !error && (
                <div className="space-y-4">
                    {topStories.map((story, index) => (
                        <div
                            key={story.id}
                            className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:bg-gray-800/50 transition-colors"
                        >
                            <div className="flex items-start">
                                <span className="text-gray-500 font-mono mr-3">
                                    {index + 1}
                                </span>
                                <div className="flex-1">
                                    <div className="flex items-start justify-between">
                                        <a
                                            href={story.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-lg font-medium text-blue-400 hover:text-blue-300 flex items-center"
                                        >
                                            {story.title}
                                            <ExternalLink className="ml-2 h-4 w-4 flex-shrink-0" />
                                        </a>

                                        <button
                                            onClick={() =>
                                                generateSummary(index)
                                            }
                                            className="ml-3 flex items-center justify-center p-1.5 rounded-md text-gray-400 hover:text-blue-400 hover:bg-gray-800 transition-colors"
                                            aria-label={
                                                story.showSummary
                                                    ? "Hide summary"
                                                    : "Show summary"
                                            }
                                            title="AI Summary"
                                        >
                                            <Bot className="h-4 w-4 mr-1" />
                                            {story.showSummary ? (
                                                <Minus className="h-3 w-3" />
                                            ) : (
                                                <Plus className="h-3 w-3" />
                                            )}
                                        </button>
                                    </div>

                                    <div className="mt-2 text-sm text-gray-400">
                                        {story.score} points by {story.by} •{" "}
                                        {formatTime(story.time)} •{" "}
                                        {story.descendants || 0} comments
                                    </div>

                                    {/* Summary section */}
                                    {story.showSummary && (
                                        <div className="mt-3 pt-3 border-t border-gray-800">
                                            {story.isSummarizing ? (
                                                <div className="flex items-center text-gray-400">
                                                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-blue-500 mr-2"></div>
                                                    Generating summary...
                                                </div>
                                            ) : story.summaryError ? (
                                                <div className="text-red-400 text-sm">
                                                    {story.summaryError}
                                                </div>
                                            ) : story.summary ? (
                                                <div>
                                                    <h4 className="text-sm font-medium text-gray-300 mb-1">
                                                        AI Summary:
                                                    </h4>
                                                    <p className="text-sm text-gray-300">
                                                        {story.summary}
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
