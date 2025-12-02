-- Migration: Create community_post_reactions table for post engagement

CREATE TABLE IF NOT EXISTS community_post_reactions (
    id BIGSERIAL NOT NULL,
    post_id BIGINT NOT NULL,
    user_id UUID NOT NULL,
    reaction_type VARCHAR(50) DEFAULT 'like',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),

    CONSTRAINT community_post_reactions_pkey PRIMARY KEY (id),

    CONSTRAINT community_post_reactions_post_id_fkey FOREIGN KEY (post_id)
        REFERENCES community_posts(id)
        ON DELETE CASCADE,

    CONSTRAINT community_post_reactions_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    
    -- Ensure one reaction per user per post
    CONSTRAINT community_post_reactions_unique_user_post UNIQUE (post_id, user_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_community_post_reactions_post_id ON community_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_community_post_reactions_user_id ON community_post_reactions(user_id);
