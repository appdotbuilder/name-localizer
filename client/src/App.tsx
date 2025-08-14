import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Heart, Volume2, Share2, Sparkles, Globe, User, Palette, Clock, Star, AlertCircle, Languages, BookOpen, Music } from 'lucide-react';
import { trpc } from '@/utils/trpc';
import type { 
  NameLocalizationResponse, 
  CreateNameLocalizationInput, 
  NameVariant, 
  TargetLanguage, 
  GenderPreference, 
  OutputFormat, 
  Tone, 
  VariantType 
} from '../../server/src/schema';

function App() {
  const [localizations, setLocalizations] = useState<NameLocalizationResponse[]>([]);
  const [favorites, setFavorites] = useState<NameLocalizationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId] = useState<string>('demo-user-' + Math.random().toString(36).substr(2, 9));

  const [formData, setFormData] = useState<CreateNameLocalizationInput>({
    original_name: '',
    target_language: 'chinese' as TargetLanguage,
    gender_preference: 'any' as GenderPreference,
    output_format: 'both' as OutputFormat,
    tone: 'modern' as Tone,
    user_id: userId
  });

  const loadFavorites = useCallback(async () => {
    try {
      setLoadingFavorites(true);
      const result = await trpc.getUserFavorites.query({ user_id: userId });
      setFavorites(result);
    } catch (error) {
      console.error('Failed to load favorites:', error);
    } finally {
      setLoadingFavorites(false);
    }
  }, [userId]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await trpc.createNameLocalization.mutate(formData);
      setLocalizations((prev: NameLocalizationResponse[]) => [response, ...prev]);
      
      // Reset only the name field, keep other preferences
      setFormData((prev: CreateNameLocalizationInput) => ({ 
        ...prev, 
        original_name: '' 
      }));
    } catch (error) {
      console.error('Failed to create localization:', error);
      setError('Failed to generate name localization. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToFavorites = async (requestId: number, variantId: number) => {
    try {
      await trpc.addToFavorites.mutate({
        user_id: userId,
        request_id: requestId,
        variant_id: variantId
      });
      loadFavorites(); // Refresh favorites
    } catch (error) {
      console.error('Failed to add to favorites:', error);
    }
  };

  const handleRemoveFavorite = async (favoriteId: number) => {
    try {
      await trpc.removeFavorite.mutate({
        user_id: userId,
        favorite_id: favoriteId
      });
      loadFavorites(); // Refresh favorites
    } catch (error) {
      console.error('Failed to remove favorite:', error);
    }
  };

  const handlePlayPronunciation = (pronunciation: string) => {
    // Text-to-speech functionality
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(pronunciation);
      utterance.rate = 0.8;
      utterance.pitch = 1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const handleShare = async (variant: NameVariant, originalName: string) => {
    const shareText = `Check out my localized name: ${variant.native_script} (${variant.romanization}) - meaning "${variant.meaning}"`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'NameLocalizer Result',
          text: shareText,
          url: window.location.href
        });
      } catch (error) {
        console.error('Failed to share:', error);
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(shareText);
      // You could add a toast notification here
    }
  };

  const getVariantTypeColor = (type: VariantType) => {
    switch (type) {
      case 'short': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'medium': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'long': return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default: return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-orange-400';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Languages className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                  NameLocalizer
                </h1>
                <p className="text-xs text-slate-400">AI-Powered Cultural Name Translation</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 text-slate-400">
              <Globe className="w-4 h-4" />
              <span className="text-sm">Powered by AI</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Tabs defaultValue="localize" className="space-y-8">
          <TabsList className="grid w-full grid-cols-2 bg-slate-900 border border-slate-800">
            <TabsTrigger value="localize" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <Sparkles className="w-4 h-4 mr-2" />
              Localize Name
            </TabsTrigger>
            <TabsTrigger value="favorites" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <Heart className="w-4 h-4 mr-2" />
              My Favorites ({favorites.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="localize" className="space-y-8">
            {/* Input Form */}
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="w-5 h-5" />
                  <span>Enter Your Name</span>
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Transform your name into culturally appropriate Chinese or Japanese variants
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-slate-300">Original Name</Label>
                      <Input
                        id="name"
                        placeholder="Enter your name..."
                        value={formData.original_name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setFormData((prev: CreateNameLocalizationInput) => ({ ...prev, original_name: e.target.value }))
                        }
                        className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Target Language</Label>
                      <Select
                        value={formData.target_language}
                        onValueChange={(value: TargetLanguage) =>
                          setFormData((prev: CreateNameLocalizationInput) => ({ ...prev, target_language: value }))
                        }
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="chinese">🇨🇳 Chinese (Mandarin)</SelectItem>
                          <SelectItem value="japanese">🇯🇵 Japanese</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Gender Preference</Label>
                      <Select
                        value={formData.gender_preference}
                        onValueChange={(value: GenderPreference) =>
                          setFormData((prev: CreateNameLocalizationInput) => ({ ...prev, gender_preference: value }))
                        }
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="any">Any Gender</SelectItem>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                          <SelectItem value="neutral">Gender Neutral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Output Format</Label>
                      <Select
                        value={formData.output_format}
                        onValueChange={(value: OutputFormat) =>
                          setFormData((prev: CreateNameLocalizationInput) => ({ ...prev, output_format: value }))
                        }
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="both">Both Scripts</SelectItem>
                          <SelectItem value="native">Native Script Only</SelectItem>
                          <SelectItem value="romanization">Romanization Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Tone</Label>
                      <Select
                        value={formData.tone}
                        onValueChange={(value: Tone) =>
                          setFormData((prev: CreateNameLocalizationInput) => ({ ...prev, tone: value }))
                        }
                      >
                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700">
                          <SelectItem value="modern">Modern</SelectItem>
                          <SelectItem value="traditional">Traditional</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || !formData.original_name.trim()}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-2.5"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        Generating Variants...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Generate Name Variants
                      </>
                    )}
                  </Button>
                </form>

                {error && (
                  <Alert className="mt-4 bg-red-950/50 border-red-800 text-red-200">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Results */}
            <div className="space-y-6">
              {localizations.map((localization: NameLocalizationResponse) => (
                <Card key={localization.id} className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          "{localization.original_name}" → {localization.target_language === 'chinese' ? '🇨🇳 Chinese' : '🇯🇵 Japanese'}
                        </CardTitle>
                        <CardDescription className="text-slate-400 flex items-center space-x-4 mt-1">
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {localization.created_at.toLocaleDateString()}
                          </span>
                          <span className="flex items-center">
                            <Palette className="w-3 h-3 mr-1" />
                            {localization.tone} tone
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {localization.variants.map((variant: NameVariant) => (
                        <Card key={variant.id} className="bg-slate-800 border-slate-700 hover:border-slate-600 transition-all duration-200">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="outline" className={`${getVariantTypeColor(variant.variant_type)} border`}>
                                {variant.variant_type}
                              </Badge>
                              <div className={`text-sm font-medium ${getConfidenceColor(variant.confidence_score)}`}>
                                <Star className="w-3 h-3 inline mr-1" />
                                {Math.round(variant.confidence_score * 100)}%
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="space-y-2">
                              {(formData.output_format === 'native' || formData.output_format === 'both') && (
                                <div className="text-2xl font-bold text-center py-2">
                                  {variant.native_script}
                                </div>
                              )}
                              {(formData.output_format === 'romanization' || formData.output_format === 'both') && (
                                <div className="text-lg text-slate-300 text-center">
                                  {variant.romanization}
                                </div>
                              )}
                            </div>

                            <Separator className="bg-slate-700" />

                            <div className="space-y-3 text-sm">
                              <div>
                                <span className="text-slate-400">Meaning:</span>
                                <p className="text-slate-200 mt-1">{variant.meaning}</p>
                              </div>
                              <div>
                                <span className="text-slate-400">Pronunciation:</span>
                                <p className="text-slate-200 mt-1">{variant.pronunciation}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handlePlayPronunciation(variant.pronunciation)}
                                  className="text-slate-400 hover:text-white hover:bg-slate-700"
                                >
                                  <Volume2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleShare(variant, localization.original_name)}
                                  className="text-slate-400 hover:text-white hover:bg-slate-700"
                                >
                                  <Share2 className="w-4 h-4" />
                                </Button>
                              </div>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleAddToFavorites(localization.id, variant.id)}
                                className="text-slate-400 hover:text-red-400 hover:bg-slate-700"
                              >
                                <Heart className="w-4 h-4" />
                              </Button>
                            </div>

                            {/* Cultural Notes Dialog */}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="w-full bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600">
                                  <BookOpen className="w-4 h-4 mr-2" />
                                  Cultural Notes
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="bg-slate-900 border-slate-700 text-white">
                                <DialogHeader>
                                  <DialogTitle className="flex items-center space-x-2">
                                    <BookOpen className="w-5 h-5" />
                                    <span>Cultural Context</span>
                                  </DialogTitle>
                                  <DialogDescription className="text-slate-400">
                                    Understanding the cultural significance of "{variant.romanization}"
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="text-center py-4 border border-slate-700 rounded-lg bg-slate-800">
                                    <div className="text-2xl font-bold mb-2">{variant.native_script}</div>
                                    <div className="text-slate-300">{variant.romanization}</div>
                                  </div>
                                  <div>
                                    <h4 className="font-semibold text-slate-200 mb-2">Cultural Notes</h4>
                                    <p className="text-slate-300 leading-relaxed">{variant.cultural_notes}</p>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="favorites" className="space-y-6">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Heart className="w-5 h-5 text-red-400" />
                  <span>My Favorite Names</span>
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Your saved name localizations
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFavorites ? (
                  <div className="space-y-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 bg-slate-800" />
                    ))}
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Heart className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No favorites yet. Start by localizing some names!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {favorites.map((favorite: NameLocalizationResponse) => (
                      <Card key={favorite.id} className="bg-slate-800 border-slate-700">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className="font-medium">"{favorite.original_name}" → {favorite.target_language === 'chinese' ? '🇨🇳 Chinese' : '🇯🇵 Japanese'}</h3>
                              <p className="text-sm text-slate-400">Saved on {favorite.created_at.toLocaleDateString()}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveFavorite(favorite.id)}
                              className="text-red-400 hover:text-red-300 hover:bg-slate-700"
                            >
                              Remove
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {favorite.variants.map((variant: NameVariant) => (
                              <div key={variant.id} className="p-3 bg-slate-900 rounded-lg border border-slate-600">
                                <div className="text-center mb-2">
                                  <div className="text-lg font-bold">{variant.native_script}</div>
                                  <div className="text-sm text-slate-300">{variant.romanization}</div>
                                </div>
                                <p className="text-xs text-slate-400 text-center">{variant.meaning}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/95 mt-16">
        <div className="container mx-auto px-4 py-6">
          <div className="text-center text-slate-400 text-sm">
            <p>NameLocalizer - AI-Powered Cultural Name Translation</p>
            <p className="mt-1">Bridging cultures through meaningful names</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;