import { Link } from 'react-router-dom';
import { Bell, HeartHandshake, ArrowRight } from 'lucide-react';
import { useSeoMeta } from '@unhead/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMannaahCampaignFollows } from '@/hooks/useMannaahCampaignFollows';
import { useAppContext } from '@/hooks/useAppContext';

export function MannaahMyHelpPage() {
  const { follows } = useMannaahCampaignFollows();
  const { config } = useAppContext();
  useSeoMeta({ title: `My Help | ${config.appName}`, description: 'Your private Mannaah campaign follow list.' });

  return (
    <main className="min-h-screen bg-[#fbf8f2] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8a765e]">Mannaah</p>
          <h1 className="mt-2 text-3xl font-semibold text-[#3f4d42]">My Help</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f6a61]">
            Keep up with campaigns you chose to follow. Following is private by default and does not create a public social relationship.
          </p>
        </div>

        {follows.length === 0 ? (
          <Card className="border-[#ded4c7] bg-white">
            <CardContent className="flex flex-col items-center px-6 py-14 text-center">
              <HeartHandshake className="size-10 text-[#8a765e]" />
              <h2 className="mt-4 text-xl font-semibold text-[#3f4d42]">Your help list is empty</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Follow a campaign when you want to hear about progress, milestones and outcomes.</p>
              <Button asChild className="mt-6"><Link to="/campaigns">Browse campaigns <ArrowRight className="ml-2 size-4" /></Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {follows.slice().sort((a, b) => b.followedAt - a.followedAt).map((item) => {
              const path = `/campaign/${item.pubkey}/${encodeURIComponent(item.identifier)}`;
              return (
                <Card key={item.aTag} className="border-[#ded4c7] bg-white">
                  <CardHeader className="flex flex-row items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg text-[#3f4d42]">{item.title}</CardTitle>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><Bell className="size-3.5" /> Private follow</p>
                    </div>
                    <Button asChild variant="outline"><Link to={path}>View campaign</Link></Button>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-[#d9cdbd] bg-white p-5 text-sm leading-6 text-[#6f6a61]">
          <strong className="text-[#3f4d42]">Privacy by default.</strong> Your follow list is stored locally on this device. Mannaah does not publish a follower count or create a public follower graph from this feature.
        </div>
      </div>
    </main>
  );
}
