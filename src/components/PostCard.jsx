import React, { useState } from 'react';
import CommentSection from './CommentSection';
import { toggleLike } from '../services/likeService';
import { useAuth } from '../context/AuthContext';

export default function PostCard({ post, onPostUpdate }) {
    const { user } = useAuth();
    const [liked, setLiked] = useState(post.user_has_liked || false);
    const [likesCount, setLikesCount] = useState(post.likes_count || 0);
    const [showComments, setShowComments] = useState(false);

    const handleLike = async () => {
        if (!user) return alert('Please login to like posts.');
        try {
            await toggleLike(post.id);
            setLiked(!liked);
            setLikesCount(liked ? likesCount - 1 : likesCount + 1);
        } catch (error) {
            console.error('Error toggling like:', error);
        }
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-4 shadow-md">
            {/* Author Info */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center font-bold text-white">
                        {post.profiles?.full_name?.[0] || 'U'}
                    </div>
                    <div>
                        <h4 className="font-semibold text-white">{post.profiles?.full_name || 'Farmer / User'}</h4>
                        <span className="text-xs text-gray-400">{new Date(post.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>

            {/* Post Content */}
            <p className="text-gray-200 text-sm mb-4 whitespace-pre-wrap">{post.content}</p>

            {/* Post Image if available */}
            {post.image_url && (
                <div className="mb-4 rounded-lg overflow-hidden border border-gray-700">
                    <img src={post.image_url} alt="Post attachment" className="w-full object-cover max-h-80" />
                </div>
            )}

            {/* Actions Bar (Like & Comment) */}
            <div className="flex items-center justify-between border-t border-gray-700 pt-3 text-sm text-gray-400">
                <button 
                    onClick={handleLike} 
                    className={`flex items-center space-x-1.5 transition ${liked ? 'text-red-500 font-semibold' : 'hover:text-red-400'}`}
                >
                    <span>❤️</span>
                    <span>{likesCount} Likes</span>
                </button>

                <button 
                    onClick={() => setShowComments(!showComments)}
                    className="flex items-center space-x-1.5 hover:text-green-400 transition"
                >
                    <span>💬</span>
                    <span>Comments ({post.comments_count || 0})</span>
                </button>
            </div>

            {/* Comments Toggle Section */}
            {showComments && (
                <div className="mt-4 pt-3 border-t border-gray-700">
                    <CommentSection postId={post.id} onCommentAdded={onPostUpdate} />
                </div>
            )}
        </div>
    );
}