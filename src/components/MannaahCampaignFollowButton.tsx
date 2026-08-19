import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMannaahCampaignFollows } from '@/hooks/useMannaahCampaignFollows';
import type { ParsedCampaign } from '@/lib/campaign';
import { useToast } from '@/hooks/useToast';

export function MannaahCampaignFollowButton({ campaign }: { campaign: ParsedCampaign }) {
  const { followed, toggleFollow } = useMannaahCampaignFollows();
  const { toast } = useToast();
  const isFollowing = followed.has(campaign.aTag);

  const handleToggle = () => {
    toggleFollow({ aTag: campaign.aTag, pubkey: campaign.pubkey, identifier: campaign.identifier, title: campaign.title });
    toast({
      title: isFollowing ? 'Campaign unfollowed' : 'Campaign followed',
      description: isFollowing
        ? 'You will no longer see this campaign in My Help.'
        : 'You can follow its progress privately from My Help.',
    });
  };

  return (
    <Button type="button" variant={isFollowing ? 'secondary' : 'outline'} onClick={handleToggle} className="gap-2">
      {isFollowing ? <BellOff className="size-4" /> : <Bell className="size-4" />}
      {isFollowing ? 'Following' : 'Follow campaign'}
    </Button>
  );
}
